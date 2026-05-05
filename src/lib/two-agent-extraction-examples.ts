/**
 * 2-Agent Extraction Examples
 * Practical usage patterns for the two-agent pipeline
 */

import {
  runTwoAgentExtraction,
  runBatchTwoAgentExtraction,
  runTargetedExtraction,
  TwoAgentExtractionConfig
} from '@/lib/two-agent-extraction';
import type { ExtractedWithReasoning } from '@/lib/source-reasoning';

/**
 * Example 1: Simple extraction with source reasoning
 */
export async function example1_simpleExtraction() {
  console.log('\n📋 Example 1: Simple Extraction with Sources\n');

  try {
    const result = await runTwoAgentExtraction(
      'Extract the primary outcome measure from the trial protocol',
      {
        targetAudience: 'general',
        verbose: true
      }
    );

    console.log('\n✅ Extracted Data (for Word doc):');
    console.log(JSON.stringify(result.data, null, 2));

    console.log('\n📚 Source Reasoning (for verification):');
    console.log(`Method: ${result.source_reasoning.extraction_method}`);
    console.log(`Verification: ${result.source_reasoning.verification_notes}`);
    console.log(`Ambiguities: ${result.source_reasoning.ambiguities}`);

    console.log('\n🔍 Source Details:');
    for (const source of result.source_reasoning.primary_sources) {
      console.log(`
  • Document: ${source.document}
    Page: ${source.page}
    Section: ${source.section}
    Confidence: ${source.confidence}
    Reason: ${source.reason}`);
    }

    return result;

  } catch (error) {
    console.error('❌ Extraction failed:', error);
    throw error;
  }
}

/**
 * Example 2: Extraction for different audiences
 */
export async function example2_multiAudience() {
  console.log('\n👥 Example 2: Different Audiences, Same Source\n');

  const audiences: Array<'patient' | 'physician' | 'researcher' | 'general'> = [
    'patient',
    'physician',
    'researcher'
  ];

  const results: Record<string, ExtractedWithReasoning> = {};

  for (const audience of audiences) {
    console.log(`🔄 Extracting for audience: ${audience}`);

    try {
      results[audience] = await runTwoAgentExtraction(
        'Extract the adverse events reported in the trial',
        {
          targetAudience: audience,
          verbose: false
        }
      );

      console.log(`   ✅ ${audience}: ${JSON.stringify(results[audience].data)}\n`);

    } catch (error) {
      console.error(`   ❌ Failed for ${audience}`);
    }
  }

  return results;
}

/**
 * Example 3: Batch extraction for full trial summary
 */
export async function example3_batchExtraction() {
  console.log('\n📦 Example 3: Batch Extraction\n');

  const extractionRequests = [
    {
      key: 'trial_title',
      prompt: 'Extract the complete title of the clinical trial'
    },
    {
      key: 'trial_phase',
      prompt: 'Extract the phase of the clinical trial (Phase 1, 2, 3, or 4)'
    },
    {
      key: 'health_condition',
      prompt: 'Extract the primary health condition or disease being studied'
    },
    {
      key: 'primary_outcome',
      prompt: 'Extract the primary outcome measure and timeframe'
    },
    {
      key: 'adverse_events',
      prompt: 'Extract the most common adverse events with frequencies'
    }
  ];

  console.log(`Starting batch extraction of ${extractionRequests.length} sections...\n`);

  try {
    const results = await runBatchTwoAgentExtraction(
      extractionRequests,
      {
        targetAudience: 'patient',
        verbose: true
      }
    );

    console.log('\n📊 Batch Results Summary:');

    for (const [key, result] of Object.entries(results)) {
      const sourceCount = result.source_reasoning?.primary_sources?.length || 0;
      const avgConfidence = result.source_reasoning?.primary_sources
        ?.reduce((sum, s) => sum + (s.confidence === 'high' ? 100 : s.confidence === 'medium' ? 70 : 40), 0) || 0;

      console.log(`
  ${key}:
    Sources: ${sourceCount}
    Data: ${JSON.stringify(result.data)}
    Avg Confidence: ${(avgConfidence / sourceCount).toFixed(0)}%`);
    }

    return results;

  } catch (error) {
    console.error('❌ Batch extraction failed:', error);
    throw error;
  }
}

/**
 * Example 4: With vector store context
 */
export async function example4_withVectorStore() {
  console.log('\n🔍 Example 4: Vector Store Context\n');

  const vectorStoreContext = `
When describing trial characteristics, use these standard terms:
- HbA1c → "blood sugar test"
- Type 2 Diabetes → "type 2 diabetes"
- Randomization → "random selection of participants"
- Efficacy → "effectiveness"
- Adverse Event → "side effect"
- Primary Endpoint → "main measurement"
- Statistical Significance → "meaningful difference"
`;

  try {
    const result = await runTargetedExtraction(
      'Extract information about the trial design',
      'patient',
      'vs-abc123',
      vectorStoreContext
    );

    console.log('✅ Data with Vector Store Context:');
    console.log(JSON.stringify(result.data, null, 2));

    console.log('\n📝 Conversion Rationale:');
    console.log(result.source_reasoning.conversion_rationale);

    return result;

  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  }
}

/**
 * Example 5: Processing with UI-ready output
 */
export async function example5_uiReadyOutput() {
  console.log('\n🎨 Example 5: UI-Ready Output Format\n');

  try {
    const result = await runTwoAgentExtraction(
      'Extract efficacy results from the trial',
      {
        targetAudience: 'general',
        verbose: false
      }
    );

    // Transform for UI display
    const uiFormat = {
      // For Word document
      documentContent: result.data,

      // For verification panel
      verification: {
        sources: result.source_reasoning.primary_sources.map(source => ({
          label: `${source.document} (p. ${source.page})`,
          section: source.section,
          confidence: source.confidence,
          reason: source.reason,
          location: source.location_details
        })),
        extractionMethod: result.source_reasoning.extraction_method,
        verificationNotes: result.source_reasoning.verification_notes,
        ambiguities: result.source_reasoning.ambiguities
      },

      // Metadata
      metadata: {
        extractedAt: new Date().toISOString(),
        audience: 'general',
        sourceCount: result.source_reasoning.primary_sources.length,
        highConfidenceSources: result.source_reasoning.primary_sources.filter(
          s => s.confidence === 'high'
        ).length
      }
    };

    console.log('📄 For Document:');
    console.log(JSON.stringify(uiFormat.documentContent, null, 2));

    console.log('\n🔍 For Verification:');
    console.log('Sources:');
    for (const source of uiFormat.verification.sources) {
      console.log(`  • ${source.label} - ${source.confidence} confidence`);
    }

    console.log('\n✓ UI format ready for frontend');
    return uiFormat;

  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  }
}

/**
 * Example 6: Error handling and fallbacks
 */
export async function example6_errorHandling() {
  console.log('\n⚠️  Example 6: Error Handling\n');

  const requests = [
    { key: 'valid_query', prompt: 'Extract trial title' },
    { key: 'ambiguous_query', prompt: 'Extract unclear information' }
  ];

  try {
    const results = await runBatchTwoAgentExtraction(requests, {
      targetAudience: 'general',
      retryAttempts: 2,
      verbose: true
    });

    for (const [key, result] of Object.entries(results)) {
      const hasData = Object.keys(result.data).length > 0;
      const sourceCount = result.source_reasoning?.primary_sources?.length || 0;

      if (hasData && sourceCount > 0) {
        console.log(`✅ ${key}: Successfully extracted`);
      } else {
        console.log(`⚠️  ${key}: Partial or failed extraction`);
        console.log(`   Ambiguities: ${result.source_reasoning.ambiguities}`);
      }
    }

  } catch (error) {
    console.error('❌ Batch processing failed:', error);
  }
}

/**
 * Example 7: Full trial extraction workflow
 */
export async function example7_fullTrialExtraction() {
  console.log('\n🏥 Example 7: Complete Trial Extraction Workflow\n');

  const trialExtractionMap = {
    identification: {
      title: 'Extract the official trial title',
      nctNumber: 'Extract the NCT (ClinicalTrials.gov) number if present',
      sponsor: 'Extract the trial sponsor/organization'
    },
    design: {
      phase: 'Extract the phase of the trial',
      type: 'Extract the trial type (RCT, observational, etc.)',
      duration: 'Extract the total duration of the trial'
    },
    population: {
      condition: 'Extract the primary health condition',
      inclusion: 'Extract key inclusion criteria (top 3-5)',
      exclusion: 'Extract key exclusion criteria',
      targetEnrollment: 'Extract target number of participants'
    },
    efficacy: {
      primaryOutcome: 'Extract primary outcome measure',
      secondaryOutcomes: 'Extract secondary outcome measures',
      results: 'Extract key efficacy results'
    },
    safety: {
      adverseEvents: 'Extract most common adverse events',
      seriousAdverseEvents: 'Extract serious adverse events if reported',
      discontinuationRate: 'Extract discontinuation rate due to adverse events'
    }
  };

  // Flatten the nested structure
  const flatRequests = Object.entries(trialExtractionMap)
    .flatMap(([category, prompts]) =>
      Object.entries(prompts).map(([key, prompt]) => ({
        key: `${category}__${key}`,
        prompt
      }))
    );

  console.log(`Starting full trial extraction (${flatRequests.length} fields)...\n`);

  try {
    const results = await runBatchTwoAgentExtraction(
      flatRequests,
      {
        targetAudience: 'general',
        verbose: false
      }
    );

    // Reorganize results by category
    const organized: Record<string, Record<string, ExtractedWithReasoning>> = {};

    for (const [key, result] of Object.entries(results)) {
      const [category, field] = key.split('__');
      if (!organized[category]) {
        organized[category] = {};
      }
      organized[category][field] = result;
    }

    // Display results
    for (const [category, fields] of Object.entries(organized)) {
      console.log(`\n📋 ${category.toUpperCase()}`);
      for (const [field, result] of Object.entries(fields)) {
        const sourceCount = result.source_reasoning?.primary_sources?.length || 0;
        const hasData = Object.keys(result.data).length > 0;

        console.log(`  ${field}: ${hasData ? '✅' : '❌'} (${sourceCount} sources)`);
      }
    }

    console.log('\n✅ Full trial extraction complete');
    return organized;

  } catch (error) {
    console.error('❌ Trial extraction failed:', error);
    throw error;
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('═'.repeat(70));
  console.log('  2-AGENT EXTRACTION EXAMPLES');
  console.log('═'.repeat(70));

  try {
    // await example1_simpleExtraction();
    // await example2_multiAudience();
    // await example3_batchExtraction();
    // await example4_withVectorStore();
    // await example5_uiReadyOutput();
    // await example6_errorHandling();
    // await example7_fullTrialExtraction();

    console.log('\n\n✅ All examples completed successfully');

  } catch (error) {
    console.error('\n\n❌ Example execution failed:', error);
  }

  console.log('\n' + '═'.repeat(70));
}

// Export for easy testing
export default {
  example1_simpleExtraction,
  example2_multiAudience,
  example3_batchExtraction,
  example4_withVectorStore,
  example5_uiReadyOutput,
  example6_errorHandling,
  example7_fullTrialExtraction,
  runAllExamples
};
