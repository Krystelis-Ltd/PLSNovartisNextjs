import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient } from '@/lib/openai';
import { withRetry } from '@/lib/retry';
import { AI_MODEL, AI_MODEL_MINI } from '@/lib/constants';
import { SOURCE_REASONING_SUFFIX } from '@/lib/source-reasoning';
import { getUserIdentity } from '@/lib/auth';
import { auditLog } from '@/lib/audit-logger';
import type { OpenAIResponsePayload, ExtractRequest } from '@/types';

export const maxDuration = 300;

/**
 * Agentic Architecture: 2-Agent Pipeline
 *
 * Agent 1 (Retrieval Agent): Uses file_search to find and extract raw scientific
 *   data from documents. Uses gpt-5.4 for maximum accuracy.
 *   Returns data + source_reasoning per key.
 *
 * Agent 2 (Conversion Agent): Takes raw scientific extractions and converts them
 *   into plain, accessible language. Uses gpt-5.4-mini for cost efficiency.
 *   Preserves source_reasoning metadata exactly.
 */

// Agent 1: Retrieval - Extract raw scientific data from documents (gpt-5.4)
async function runRetrievalAgent(
    keys: string[],
    batchPrompts: Record<string, string>,
    vectorStoreId: string,
    contextData: Record<string, unknown> | null
): Promise<string> {
    const retrievalSystemPrompt = `
<system_role>
You are "Agent 1: Scientific Document Retrieval Specialist."
Your ONLY job is to accurately EXTRACT raw data from the uploaded clinical/scientific documents.
You must be precise, thorough, and faithful to the source material.
</system_role>

<core_directives>
1. Use your file_search tool to find and extract the requested information from the uploaded documents.
2. Extract the data EXACTLY as it appears in the source — do NOT simplify, paraphrase, or translate terminology yet.
3. Your ENTIRE response must be a single, valid, raw JSON object. NO Markdown fences. NO text before/after.
4. For EVERY task key, you MUST return a JSON object containing "data" and "source_reasoning".
5. Use the <previous_extractions_context> to understand foundational study facts.
</core_directives>

<previous_extractions_context>
${contextData ? JSON.stringify(contextData, null, 2) : "No previous context compiled yet."}
</previous_extractions_context>
`;

    const combinedPrompt = `Extract the following data points from the provided documents. Return raw scientific data as-is from the source.
You MUST return a SINGLE valid JSON object with the exact TASK KEYs below.

${keys.map(k => `==============================
TASK KEY: "${k}"
EXTRACTION INSTRUCTIONS:
${batchPrompts[k]}
`).join('\n\n')}

${SOURCE_REASONING_SUFFIX}
`;

    return withRetry(async () => {
        const openai = getOpenAIClient();
        const response = await (openai as unknown as { responses: { create: (opts: Record<string, unknown>) => Promise<OpenAIResponsePayload> } }).responses.create({
            model: AI_MODEL,
            instructions: retrievalSystemPrompt,
            input: combinedPrompt,
            reasoning: { effort: "low" },
            tools: [{
                type: "file_search",
                vector_store_ids: [vectorStoreId],
            }],
            text: {}
        });
        const raw = response.output_text || "";
        if (!raw) throw new Error("Empty response from retrieval agent");
        return raw;
    }, { label: 'Retrieval Agent' });
}

// Agent 2: Conversion - Convert scientific language to plain language (gpt-5.4-mini)
async function runConversionAgent(rawExtraction: string): Promise<string> {
    const conversionSystemPrompt = `
<system_role>
You are "Agent 2: Plain Language Conversion Specialist."
Your job is to take raw scientific/clinical data and convert ALL text values into clear, plain language
that a 6th-8th grade reader can understand, while preserving the exact JSON structure.
</system_role>

<conversion_rules>
1. PRESERVE the exact JSON structure, keys, nesting, arrays, and data types.
2. CONVERT scientific/medical terminology into plain, everyday language.
3. NEVER change: numbers, percentages, dates, boolean values, null values, JSON keys.
4. Keep sentences short and direct. Use active voice.
5. Replace jargon: "adverse events" → "medical problems", "efficacy" → "effects", "subjects/patients" → "participants".
6. Your ENTIRE response must be a single valid raw JSON object. NO markdown fences.
7. CRITICAL: You MUST preserve "source_reasoning" metadata blocks EXACTLY as received. Do NOT modify, simplify, or remove any source_reasoning data.
</conversion_rules>
`;

    const conversionPrompt = `Convert the following extracted scientific data into plain, accessible language.
Keep the JSON structure identical. Only simplify the text content within string values.
IMPORTANT: Preserve all "source_reasoning" blocks exactly as they are — do NOT modify them.

RAW SCIENTIFIC DATA:
${rawExtraction}`;

    return withRetry(async () => {
        const openai = getOpenAIClient();
        const response = await (openai as unknown as { responses: { create: (opts: Record<string, unknown>) => Promise<OpenAIResponsePayload> } }).responses.create({
            model: AI_MODEL_MINI,
            instructions: conversionSystemPrompt,
            input: conversionPrompt,
            reasoning: { effort: "low" },
            text: {}
        });
        const converted = response.output_text || "";
        if (!converted) throw new Error("Empty response from conversion agent");
        return converted;
    }, { label: 'Conversion Agent' });
}

function stripMarkdownFences(text: string): string {
    return text.replace(/^```json/mi, '').replace(/```$/m, '').trim();
}

export async function POST(request: NextRequest) {
    try {
        const userId = getUserIdentity(request);
        const body: ExtractRequest = await request.json();
        const { batchPrompts, vectorStoreId, contextData } = body;

        if (!batchPrompts || typeof batchPrompts !== 'object' || !vectorStoreId) {
            return NextResponse.json({ error: 'Missing batchPrompts or vectorStoreId' }, { status: 400 });
        }

        const keys = Object.keys(batchPrompts);
        auditLog({
            request, action: 'DATA_EXTRACT',
            resource: { type: 'API', path: '/api/extract' },
            status: { code: 200, result: 'SUCCESS' },
            details: { keys, vectorStoreId }
        });

        // === AGENT 1: Retrieval (gpt-5.4) ===
        console.log("[extract] Agent 1 (Retrieval/gpt-5.4): Starting for keys:", keys);
        let rawExtraction = await runRetrievalAgent(keys, batchPrompts, vectorStoreId, contextData ?? null);

        if (!rawExtraction) {
            throw new Error("Agent 1 (Retrieval) returned empty response");
        }
        rawExtraction = stripMarkdownFences(rawExtraction);
        console.log("[extract] Agent 1 (Retrieval/gpt-5.4): Complete");

        // === AGENT 2: Conversion (gpt-5.4-mini) ===
        console.log("[extract] Agent 2 (Conversion/gpt-5.4-mini): Starting plain language conversion");
        let raw = await runConversionAgent(rawExtraction);

        if (!raw) {
            console.warn("[extract] Agent 2 (Conversion) returned empty, falling back to Agent 1 output");
            raw = rawExtraction;
        }
        raw = stripMarkdownFences(raw);
        console.log("[extract] Agent 2 (Conversion/gpt-5.4-mini): Complete");

        return NextResponse.json({ raw });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[extract] Pipeline error:", msg);
        auditLog({
            request, action: 'SYSTEM_ERROR',
            resource: { type: 'API', path: '/api/extract' },
            status: { code: 500, result: 'FAILURE' },
            details: { error: msg }
        });
        return NextResponse.json(
            { error: "Extraction failed" },
            { status: 500 }
        );
    }
}
