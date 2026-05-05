/**
 * GPT-5.4 Extraction Examples
 * Quick reference for using the new extraction utilities
 */

import {
  extractWithPersistence,
  extractMultipleSections,
  extractWithFallback,
  extractWithConfidence,
  extractBatch
} from '@/lib/gpt54-extraction';

/**
 * Example 1: Simple extraction with retries
 */
export async function example1_simpleExtraction() {
  const prompt = `Extract trial parts from the clinical study report.
Return JSON: {"parts": [], "description": ""}`;

  const result = await extractWithPersistence(
    prompt,
    'trial_parts',
    { verbose: true, retryAttempts: 3 }
  );

  console.log('Result:', result);
  // Output:
  // [✓] trial_parts (attempt 1)
  // Result: { data: {...}, success: true, attempts: 1 }
}

/**
 * Example 2: Extract multiple sections in parallel
 */
export async function example2_parallelExtraction() {
  const prompts = {
    trial_parts: `Extract trial parts.
Return JSON: {"parts": [], "description": ""}`,
    
    early_termination: `Check if trial terminated early.
Return JSON: {"terminated": false, "date": "", "reason": ""}`,
    
    participant_flow: `Extract participant flow.
Return JSON: {"total": 0, "completed": 0, "withdrew": 0}`
  };

  const results = await extractMultipleSections(prompts, { verbose: true });

  for (const [section, result] of Object.entries(results)) {
    console.log(`${section}: ${result.success ? '✓' : '✗'}`);
  }
}

/**
 * Example 3: Extraction with confidence scoring
 */
export async function example3_withConfidence() {
  const prompt = `Extract adverse events from trial.
Return JSON: {"events": [], "serious": []}`;

  const result = await extractWithConfidence(
    prompt,
    'adverse_events',
    { verbose: true }
  );

  console.log(`Confidence: ${result.confidence}%`);
  console.log(`Attempts: ${result.attempts}`);
  console.log(`Data:`, result.data);
}

/**
 * Example 4: Safe extraction with fallback
 */
export async function example4_withFallback() {
  const prompt = `Extract complex data...`;
  const fallback = {
    data: [],
    error: 'Extraction failed, using default'
  };

  const data = await extractWithFallback(
    prompt,
    'complex_section',
    fallback,
    { retryAttempts: 2 }
  );

  console.log('Data:', data);
}

/**
 * Example 5: Batch processing with progress
 */
export async function example5_batchWithProgress() {
  const prompts = {
    section1: 'Extract...',
    section2: 'Extract...',
    section3: 'Extract...',
  };

  const results = await extractBatch(
    prompts,
    (section, completed, total) => {
      console.log(`Progress: ${completed}/${total} - Currently: ${section}`);
    },
    { verbose: false } // Minimal output
  );

  // Summarize results
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  console.log(`Average confidence: ${avgConfidence.toFixed(1)}%`);
  console.log(`Completed: ${results.filter(r => r.confidence > 80).length}/${results.length}`);
}

/**
 * Example 6: Integration with API route
 */
export async function example6_apiIntegration() {
  // In your API route handler:
  const prompts = {
    participant_flow: 'Extract participant flow...',
    safety_summary: 'Extract safety data...'
  };

  const config = {
    model: 'gpt-5.4',
    maxTokens: 4096,
    retryAttempts: 3,
    verbose: false // No console spam
  };

  const results = await extractMultipleSections(prompts, config);

  // Return to client
  return {
    success: Object.values(results).every(r => r.success),
    results,
    timestamp: new Date().toISOString(),
    model: 'gpt-5.4',
    toolPersistence: true
  };
}

/**
 * Example 7: Advanced - Real extraction workflow
 */
export async function example7_fullWorkflow(documentId: string) {
  console.log('Starting extraction workflow...');

  // Load prompts from extracted_data.json
  const prompts = {
    title: 'Extract trial title...',
    health_condition: 'Extract health condition...',
    trial_parts: 'Extract trial parts...',
    early_termination: 'Check if trial terminated early...',
    // ... more prompts
  };

  // Extract with confidence scoring
  console.log('Extracting all sections...');
  const results = await extractBatch(
    prompts,
    (section, completed, total) => {
      const percentage = Math.round((completed / total) * 100);
      process.stdout.write(`\rProgress: ${percentage}% (${completed}/${total})`);
    },
    { verbose: false }
  );

  // Filter high-confidence results
  const highConfidence = results.filter(r => r.confidence > 80);
  const lowConfidence = results.filter(r => r.confidence <= 80);

  console.log('\n✓ Extraction complete');
  console.log(`High confidence: ${highConfidence.length}/${results.length}`);
  
  if (lowConfidence.length > 0) {
    console.warn(`Low confidence sections: ${lowConfidence.map(r => r.section).join(', ')}`);
  }

  // Return structured result
  return {
    documentId,
    results,
    summary: {
      total: results.length,
      highConfidence: highConfidence.length,
      lowConfidence: lowConfidence.length,
      avgConfidence: (results.reduce((sum, r) => sum + r.confidence, 0) / results.length).toFixed(1),
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Running examples
 */
export async function runAllExamples() {
  console.log('='.repeat(60));
  console.log('GPT-5.4 Extraction Examples');
  console.log('='.repeat(60));

  try {
    console.log('\n1. Simple Extraction:');
    await example1_simpleExtraction();

    console.log('\n2. Parallel Extraction:');
    await example2_parallelExtraction();

    console.log('\n3. With Confidence:');
    await example3_withConfidence();

    console.log('\n4. With Fallback:');
    await example4_withFallback();

    console.log('\n5. Batch with Progress:');
    await example5_batchWithProgress();

    console.log('\nExamples complete!');
  } catch (error) {
    console.error('Example error:', error);
  }
}
