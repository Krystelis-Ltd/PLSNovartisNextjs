/**
 * 2-Agent Extraction Service
 * Agent 1: Retrieval (raw data + sources)
 * Agent 2: Conversion (plain language + verified sources)
 */

import { getOpenAIClient } from './openai';
import {
  buildTwoAgentExtractionPrompt,
  validateSourceReasoning,
  RETRIEVAL_AGENT_SYSTEM,
  CONVERSION_AGENT_SYSTEM,
  ExtractedWithReasoning,
  SourceReasoning
} from './source-reasoning';

export interface TwoAgentExtractionConfig {
  vectorStoreId?: string;
  targetAudience?: string; // e.g., "patient", "physician", "researcher"
  verbose?: boolean;
  retryAttempts?: number;
}

/**
 * Agent 1: Retrieval Agent
 * Extracts raw data with complete source documentation
 */
async function runRetrievalAgent(
  userPrompt: string,
  vectorStoreId?: string,
  verbose: boolean = false
): Promise<{ data: unknown; sources: unknown[] }> {
  const client = getOpenAIClient();

  const systemPrompt = `${RETRIEVAL_AGENT_SYSTEM}

VECTOR STORE: ${vectorStoreId || 'None'}

Use file_search tool to find data in the vector store.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-5.4',
      max_tokens: 4096,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    let rawText = response.choices[0]?.message?.content?.trim() || '';

    if (!rawText) {
      throw new Error('No response from retrieval agent');
    }

    const result = JSON.parse(rawText);

    if (verbose) {
      console.log('[Agent 1] Retrieval complete - sources found:', result.sources?.length || 0);
    }

    return {
      data: result.data || {},
      sources: result.sources || []
    };

  } catch (error) {
    if (verbose) {
      console.error('[Agent 1] Retrieval failed:', error);
    }
    throw error;
  }
}

/**
 * Agent 2: Conversion Agent
 * Converts raw data to plain language with source reasoning
 */
async function runConversionAgent(
  rawData: unknown,
  sources: unknown[],
  targetAudience: string,
  vectorStoreContext?: string,
  verbose: boolean = false
): Promise<ExtractedWithReasoning> {
  const client = getOpenAIClient();

  const systemPrompt = `${CONVERSION_AGENT_SYSTEM}

TARGET AUDIENCE: ${targetAudience}
${vectorStoreContext ? `\nVECTOR STORE WORDING CONTEXT:\n${vectorStoreContext}` : ''}`;

  const userPrompt = `
Convert this raw scientific extraction to plain language for: ${targetAudience}

RAW DATA FROM AGENT 1:
${JSON.stringify(rawData, null, 2)}

SOURCE LOCATIONS (preserve these):
${JSON.stringify(sources, null, 2)}

Use relatable language while maintaining accuracy. Preserve all source information.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-5.4',
      max_tokens: 4096,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    let rawText = response.choices[0]?.message?.content?.trim() || '';

    if (!rawText) {
      throw new Error('No response from conversion agent');
    }

    const result = JSON.parse(rawText);
    const { valid, errors } = validateSourceReasoning(result);

    if (!valid) {
      if (verbose) {
        console.warn('[Agent 2] Validation issues:', errors);
      }
    }

    if (verbose) {
      console.log('[Agent 2] Conversion complete - sources verified');
    }

    return result as ExtractedWithReasoning;

  } catch (error) {
    if (verbose) {
      console.error('[Agent 2] Conversion failed:', error);
    }
    throw error;
  }
}

/**
 * Full 2-Agent Pipeline
 */
export async function runTwoAgentExtraction(
  userRequest: string,
  config: TwoAgentExtractionConfig = {}
): Promise<ExtractedWithReasoning> {
  const {
    vectorStoreId,
    targetAudience = 'general audience',
    verbose = false,
    retryAttempts = 2
  } = config;

  if (verbose) {
    console.log('🔄 Starting 2-Agent Extraction Pipeline');
    console.log(`📋 Request: ${userRequest.substring(0, 100)}...`);
  }

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt < retryAttempts) {
    attempt++;

    try {
      // AGENT 1: Retrieval
      if (verbose) {
        console.log(`\n[Agent 1] Attempt ${attempt}/${retryAttempts} - Retrieving raw data...`);
      }

      const { data: rawData, sources } = await runRetrievalAgent(
        userRequest,
        vectorStoreId,
        verbose
      );

      // AGENT 2: Conversion
      if (verbose) {
        console.log('[Agent 2] Converting to plain language...');
      }

      const result = await runConversionAgent(
        rawData,
        sources,
        targetAudience,
        undefined,
        verbose
      );

      if (verbose) {
        console.log('\n✅ 2-Agent pipeline complete');
        console.log(`📊 Result has ${result.source_reasoning?.primary_sources?.length || 0} sources`);
      }

      return result;

    } catch (error) {
      lastError = error as Error;

      if (verbose) {
        console.warn(`❌ Attempt ${attempt} failed:`, lastError.message);
      }

      if (attempt < retryAttempts) {
        // Exponential backoff
        const delay = Math.pow(2, attempt - 1) * 1000;
        if (verbose) {
          console.log(`⏳ Retrying in ${delay}ms...`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  if (verbose) {
    console.error('❌ 2-Agent pipeline failed after all retries');
  }

  throw lastError || new Error('2-Agent extraction failed');
}

/**
 * Batch extraction with 2-agent pipeline
 */
export async function runBatchTwoAgentExtraction(
  requests: { key: string; prompt: string }[],
  config: TwoAgentExtractionConfig = {}
): Promise<Record<string, ExtractedWithReasoning>> {
  const results: Record<string, ExtractedWithReasoning> = {};
  const { verbose = false } = config;

  if (verbose) {
    console.log(`\n🔄 Batch 2-Agent Extraction (${requests.length} items)`);
  }

  for (let i = 0; i < requests.length; i++) {
    const { key, prompt } = requests[i];

    try {
      if (verbose) {
        console.log(`\n[${i + 1}/${requests.length}] Processing: ${key}`);
      }

      results[key] = await runTwoAgentExtraction(prompt, config);

    } catch (error) {
      if (verbose) {
        console.error(`[${key}] Failed:`, error);
      }

      // Return empty result
      results[key] = {
        data: {},
        source_reasoning: {
          primary_sources: [],
          extraction_method: 'Failed',
          verification_notes: 'Extraction failed',
          ambiguities: 'Error during extraction'
        }
      };
    }
  }

  if (verbose) {
    const successful = Object.values(results).filter(
      r => r.source_reasoning?.primary_sources?.length > 0
    ).length;
    console.log(`\n✅ Batch complete: ${successful}/${requests.length} successful`);
  }

  return results;
}

/**
 * Extract with explicit audience and vector store context
 */
export async function runTargetedExtraction(
  userRequest: string,
  targetAudience: 'patient' | 'physician' | 'researcher' | 'general',
  vectorStoreId?: string,
  vectorStoreContext?: string
): Promise<ExtractedWithReasoning> {
  const client = getOpenAIClient();

  const { agent1: agent1Prompt } = buildTwoAgentExtractionPrompt(
    userRequest,
    vectorStoreContext,
    targetAudience
  );

  // Run Agent 1
  const agent1Response = await client.chat.completions.create({
    model: 'gpt-5.4',
    max_tokens: 4096,
    messages: [
      { role: 'system', content: RETRIEVAL_AGENT_SYSTEM },
      { role: 'user', content: agent1Prompt }
    ]
  });

  let agent1Text = agent1Response.choices[0]?.message?.content?.trim() || '';

  const agent1Data = JSON.parse(agent1Text);

  // Run Agent 2
  const agent2Prompt = `
Based on this raw extraction, convert to plain language for ${targetAudience}:

${JSON.stringify(agent1Data, null, 2)}

${vectorStoreContext ? `\nUse this wording guide:\n${vectorStoreContext}\n` : ''}

Return full source_reasoning with all reference details.`;

  const agent2Response = await client.chat.completions.create({
    model: 'gpt-5.4',
    max_tokens: 4096,
    messages: [
      { role: 'system', content: CONVERSION_AGENT_SYSTEM },
      { role: 'user', content: agent2Prompt }
    ]
  });

  let agent2Text = agent2Response.choices[0]?.message?.content?.trim() || '';

  return JSON.parse(agent2Text) as ExtractedWithReasoning;
}
