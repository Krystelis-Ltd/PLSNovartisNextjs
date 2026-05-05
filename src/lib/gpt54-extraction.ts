/**
 * GPT-5.4 Extraction Utility
 * Minimal verbosity, maximum correctness with tool persistence
 */

import { getOpenAIClient } from './openai';
import { EXTRACTION_DEVELOPER_INSTRUCTIONS, validateExtractedJSON } from './extraction-instructions';

export interface ExtractionConfig {
  model?: string;
  maxTokens?: number;
  retryAttempts?: number;
  verbose?: boolean;
}

const DEFAULT_CONFIG: ExtractionConfig = {
  model: 'gpt-5.4',
  maxTokens: 4096,
  retryAttempts: 3,
  verbose: false
};

/**
 * Extract single section with retries on empty results
 */
export async function extractWithPersistence(
  prompt: string,
  section: string,
  config: ExtractionConfig = DEFAULT_CONFIG
): Promise<{ data: unknown; success: boolean; attempts: number }> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts < finalConfig.retryAttempts!) {
    attempts++;
    
    try {
      const client = getOpenAIClient();
      
      const response = await client.chat.completions.create({
        model: finalConfig.model!,
        max_tokens: finalConfig.maxTokens,
        messages: [
          {
            role: 'system',
            content: EXTRACTION_DEVELOPER_INSTRUCTIONS
          },
          {
            role: 'user',
            content: `${prompt}\n\nReturn ONLY valid JSON.`
          }
        ]
      });

      let rawText = response.choices[0]?.message?.content?.trim() || '';

      if (!rawText) {
        if (attempts < finalConfig.retryAttempts!) {
          continue; // Retry
        }
        return { data: {}, success: false, attempts };
      }

      // Parse and validate
      const data = JSON.parse(rawText);
      const { valid, errors } = validateExtractedJSON(data);

      if (!valid) {
        if (finalConfig.verbose) {
          console.warn(`[${section}] Validation issues (attempt ${attempts}):`, errors);
        }
        if (attempts < finalConfig.retryAttempts!) {
          continue; // Retry
        }
      }

      if (finalConfig.verbose) {
        console.log(`[✓] ${section} (attempt ${attempts})`);
      }

      return { data, success: true, attempts };

    } catch (error) {
      lastError = error as Error;
      
      if (finalConfig.verbose) {
        console.warn(`[${section}] Attempt ${attempts} failed:`, lastError.message);
      }

      if (attempts < finalConfig.retryAttempts!) {
        // Exponential backoff before retry
        const delay = Math.pow(2, attempts - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  return {
    data: {},
    success: false,
    attempts
  };
}

/**
 * Extract multiple sections in parallel with persistence
 */
export async function extractMultipleSections(
  promptsMap: Record<string, string>,
  config: ExtractionConfig = DEFAULT_CONFIG
): Promise<Record<string, { data: unknown; success: boolean; attempts: number }>> {
  const results: Record<string, { data: unknown; success: boolean; attempts: number }> = {};

  const promises = Object.entries(promptsMap).map(async ([section, prompt]) => {
    const result = await extractWithPersistence(prompt, section, config);
    return { section, result };
  });

  const completed = await Promise.all(promises);

  for (const { section, result } of completed) {
    results[section] = result;
  }

  return results;
}

/**
 * Extract with automatic fallback on complete failure
 */
export async function extractWithFallback(
  prompt: string,
  section: string,
  fallbackData: unknown = {},
  config: ExtractionConfig = DEFAULT_CONFIG
): Promise<unknown> {
  const result = await extractWithPersistence(prompt, section, config);
  
  if (result.success) {
    return result.data;
  }

  if (config.verbose) {
    console.warn(`[${section}] Using fallback after ${result.attempts} attempts`);
  }

  return fallbackData;
}

/**
 * Extract with structured confidence scoring
 */
export interface ConfidenceResult {
  section: string;
  data: unknown;
  confidence: number; // 0-100
  timestamp: string;
  attempts: number;
}

export async function extractWithConfidence(
  prompt: string,
  section: string,
  config: ExtractionConfig = DEFAULT_CONFIG
): Promise<ConfidenceResult> {
  const startTime = Date.now();
  const result = await extractWithPersistence(prompt, section, config);

  // Calculate confidence based on:
  // - Success (100 if success, 0 if fail)
  // - Attempt efficiency (fewer attempts = higher confidence)
  // - Response time (faster = more likely correct)
  const baseConfidence = result.success ? 90 : 10;
  const attemptPenalty = (result.attempts - 1) * 5; // -5 per extra attempt
  const confidence = Math.max(0, Math.min(100, baseConfidence - attemptPenalty));

  return {
    section,
    data: result.data,
    confidence,
    timestamp: new Date().toISOString(),
    attempts: result.attempts
  };
}

/**
 * Batch extraction with progress callback
 */
export async function extractBatch(
  promptsMap: Record<string, string>,
  onProgress?: (section: string, completed: number, total: number) => void,
  config: ExtractionConfig = DEFAULT_CONFIG
): Promise<ConfidenceResult[]> {
  const sections = Object.entries(promptsMap);
  const results: ConfidenceResult[] = [];

  for (let i = 0; i < sections.length; i++) {
    const [section, prompt] = sections[i];
    
    const result = await extractWithConfidence(prompt, section, config);
    results.push(result);

    if (onProgress) {
      onProgress(section, i + 1, sections.length);
    }
  }

  return results;
}
