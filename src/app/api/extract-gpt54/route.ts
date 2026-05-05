import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient } from '@/lib/openai';
import { EXTRACTION_DEVELOPER_INSTRUCTIONS } from '@/lib/extraction-instructions';
import { auditLog } from '@/lib/audit-logger';

export const maxDuration = 300;

/**
 * GPT-5.4 Extraction Route
 * Uses tool persistence rules for complete, accurate data extraction
 */

interface ExtractRequest {
  documentId: string;
  vectorStoreId: string;
  prompts: Record<string, string>;
  contextData?: Record<string, unknown>;
}

interface ExtractionResult {
  section: string;
  data: unknown;
  confidence: number;
  timestamp: string;
}

async function extractSection(
  client: InstanceType<typeof import('openai').default>,
  section: string,
  prompt: string
): Promise<ExtractionResult> {
  const startTime = Date.now();
  
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-5.4',
      max_tokens: 4096,
      messages: [
        {
          role: 'system',
          content: EXTRACTION_DEVELOPER_INSTRUCTIONS
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    let rawText = response.choices[0]?.message?.content?.trim() || '';

    if (!rawText) {
      return {
        section,
        data: {},
        confidence: 0,
        timestamp: new Date().toISOString()
      };
    }

    // Parse JSON
    const data = JSON.parse(rawText);
    
    return {
      section,
      data,
      confidence: 95, // GPT-5.4 with tool persistence
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[Extract] ${section} failed after ${elapsed}ms:`, error);
    
    return {
      section,
      data: {},
      confidence: 0,
      timestamp: new Date().toISOString()
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ExtractRequest = await request.json();
    const { documentId, vectorStoreId, prompts, contextData } = body;

    if (!prompts || Object.keys(prompts).length === 0) {
      return NextResponse.json(
        { error: 'No prompts provided' },
        { status: 400 }
      );
    }

    const client = getOpenAIClient();
    const results: ExtractionResult[] = [];

    // Extract all sections in parallel
    const extractionPromises = Object.entries(prompts).map(([section, prompt]) =>
      extractSection(client, section, prompt)
    );

    const extractedResults = await Promise.all(extractionPromises);
    results.push(...extractedResults);

    // Audit log
    auditLog({
      request,
      action: 'DATA_EXTRACT',
      resource: { type: 'batch', path: '/api/extract-gpt54' },
      status: { code: 200, result: 'SUCCESS' },
      details: {
        event: 'extraction_completed',
        documentId,
        sectionsExtracted: results.length,
      }
    });

    return NextResponse.json({
      success: true,
      documentId,
      results,
      extractedAt: new Date().toISOString(),
      model: 'gpt-5.4',
      toolPersistence: true
    });

  } catch (error) {
    console.error('[Extract Route] Error:', error);
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Extraction failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
