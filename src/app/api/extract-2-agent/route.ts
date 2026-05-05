import { NextRequest, NextResponse } from 'next/server';
import { runTwoAgentExtraction, runBatchTwoAgentExtraction } from '@/lib/two-agent-extraction';
import { auditLog } from '@/lib/audit-logger';

export const maxDuration = 300;

interface TwoAgentExtractRequest {
  requests: Array<{
    key: string;
    prompt: string;
  }>;
  vectorStoreId?: string;
  targetAudience?: 'patient' | 'physician' | 'researcher' | 'general';
  verbose?: boolean;
}

interface TwoAgentExtractResponse {
  success: boolean;
  results: Record<string, {
    data: Record<string, unknown>;
    source_reasoning: {
      primary_sources: Array<{
        document: string;
        page: string;
        section: string;
        table: string | null;
        location_details: string;
        reason?: string;
        confidence: 'high' | 'medium' | 'low';
      }>;
      extraction_method: string;
      verification_notes: string;
      ambiguities: string;
      conversion_rationale?: string;
    };
  }>;
  metadata: {
    timestamp: string;
    totalRequests: number;
    successfulExtractions: number;
    pipelineMode: '2-agent';
    targetAudience: string;
  };
}

/**
 * POST /api/extract-2-agent
 * 2-Agent Extraction with Source Reasoning
 *
 * Agent 1: Retrieves raw data with source locations
 * Agent 2: Converts to plain language while preserving sources
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const body: TwoAgentExtractRequest = await request.json();
    const {
      requests,
      vectorStoreId,
      targetAudience = 'general',
      verbose = false
    } = body;

    if (!requests || requests.length === 0) {
      return NextResponse.json(
        { error: 'No extraction requests provided' },
        { status: 400 }
      );
    }

    if (verbose) {
      console.log(`\n🔄 2-Agent Extraction Started`);
      console.log(`📋 Requests: ${requests.length}`);
      console.log(`👥 Target Audience: ${targetAudience}`);
      console.log(`📚 Vector Store: ${vectorStoreId || 'None'}`);
    }

    // Run batch extraction with 2-agent pipeline
    const results = await runBatchTwoAgentExtraction(
      requests,
      {
        vectorStoreId,
        targetAudience,
        verbose,
        retryAttempts: 2
      }
    );

    // Count successful extractions
    const successfulCount = Object.values(results).filter(
      r => r.source_reasoning?.primary_sources?.length > 0
    ).length;

    if (verbose) {
      console.log(`\n✅ Extraction Complete`);
      console.log(`📊 Successful: ${successfulCount}/${requests.length}`);
      console.log(`⏱️  Duration: ${Date.now() - startTime}ms`);
    }

    // Audit log
    auditLog({
      request,
      action: 'DATA_EXTRACT',
      resource: { type: 'batch', path: '/api/extract-2-agent' },
      status: { code: 200, result: 'SUCCESS' },
      details: {
        event: 'two_agent_extraction_completed',
        totalRequests: requests.length,
        successfulExtractions: successfulCount,
        targetAudience,
        vectorStoreId,
        duration: Date.now() - startTime,
      }
    });

    const response: TwoAgentExtractResponse = {
      success: true,
      results,
      metadata: {
        timestamp: new Date().toISOString(),
        totalRequests: requests.length,
        successfulExtractions: successfulCount,
        pipelineMode: '2-agent',
        targetAudience
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[2-Agent Extract] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Extraction failed';

    auditLog({
      request,
      action: 'DATA_EXTRACT',
      resource: { type: 'batch', path: '/api/extract-2-agent' },
      status: { code: 500, result: 'FAILURE' },
      details: {
        event: 'two_agent_extraction_failed',
        error: errorMessage,
        duration: Date.now() - startTime,
      }
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/extract-2-agent/example
 * Returns example request/response for 2-agent extraction
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    description: '2-Agent Extraction with Source Reasoning',
    agents: {
      agent1: 'Retrieval - Extracts raw data with source documentation',
      agent2: 'Conversion - Converts to plain language preserving all sources'
    },
    exampleRequest: {
      requests: [
        {
          key: 'primary_outcome',
          prompt: 'Extract the primary outcome measure from the trial protocol'
        },
        {
          key: 'safety_summary',
          prompt: 'Summarize the adverse events reported in the study'
        }
      ],
      vectorStoreId: 'vs-abc123',
      targetAudience: 'patient',
      verbose: true
    },
    exampleResponse: {
      success: true,
      results: {
        primary_outcome: {
          data: {
            outcome: 'Change in HbA1c from baseline to week 24',
            timeframe: 'Baseline to Week 24'
          },
          source_reasoning: {
            primary_sources: [
              {
                document: 'Protocol_v3.docx',
                page: '18',
                section: '6.2 Primary Efficacy Endpoint',
                table: 'Table 4: Study Endpoints',
                location_details: 'First row under Primary Endpoint heading',
                reason: 'Official endpoint definition in protocol',
                confidence: 'high'
              }
            ],
            extraction_method: 'Used file_search with query "primary outcome endpoint"',
            verification_notes: 'Cross-referenced with statistical analysis plan',
            ambiguities: 'None - clearly defined throughout protocol'
          }
        }
      },
      metadata: {
        timestamp: '2026-05-04T10:30:00Z',
        totalRequests: 2,
        successfulExtractions: 2,
        pipelineMode: '2-agent',
        targetAudience: 'patient'
      }
    },
    targetAudiences: ['patient', 'physician', 'researcher', 'general'],
    features: [
      'Source documentation with exact page numbers',
      'Multiple source support for cross-verification',
      'Confidence ratings (high/medium/low)',
      'Plain language conversion for target audience',
      'Extraction method documentation',
      'Ambiguity and assumption tracking',
      'Batch extraction with retry logic'
    ]
  });
}
