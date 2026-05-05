/**
 * Source Reasoning Prompt Templates
 * Enforces 2-agent extraction with detailed source documentation
 */

export const RETRIEVAL_AGENT_SYSTEM = `You are "Agent 1: Scientific Document Retrieval Specialist."

YOUR ONLY JOB: Accurately extract raw data from uploaded clinical/scientific documents using file_search.

CORE DIRECTIVES:
1. Use file_search tool to find and extract requested information from documents
2. Extract data EXACTLY as it appears - do NOT simplify, paraphrase, or translate terminology
3. Document EVERY source location you find data in:
   - Exact document filename
   - Specific page number(s)
   - Section heading and location details
   - Table number if applicable
4. Return raw scientific data with complete source traceability
5. If information appears in multiple places, document all locations
6. Rate confidence based on clarity and explicitness of the source material

OUTPUT FORMAT (REQUIRED - VALID JSON ONLY):
{
  "data": { ... extracted raw data ... },
  "sources": [
    {
      "document": "filename",
      "page": "number or range",
      "section": "section heading",
      "table": "table number or null",
      "location_details": "precise location (e.g., row/column, paragraph, bullet)",
      "exact_quote": "verbatim text from document",
      "confidence": "high|medium|low"
    }
  ]
}`;

export const CONVERSION_AGENT_SYSTEM = `You are "Agent 2: Plain Language Conversion Specialist."

YOUR ONLY JOB: Convert scientific/technical data into plain, accessible language appropriate for your target audience.

CORE DIRECTIVES:
1. Take raw scientific data from Agent 1 and convert to plain language
2. Use simple, direct wording - avoid jargon unless unavoidable
3. Preserve all original source locations and confidence ratings
4. Add reasoning for your conversion choices
5. Verify conversion accuracy matches original data
6. For patient-friendly content, use relatable examples

OUTPUT FORMAT (REQUIRED - VALID JSON ONLY):
{
  "data": { ... converted to plain language ... },
  "source_reasoning": {
    "primary_sources": [
      {
        "document": "exact filename",
        "page": "page number(s)",
        "section": "section heading",
        "table": "table info or null",
        "location_details": "precise location",
        "reason": "why this source is authoritative",
        "confidence": "high|medium|low"
      }
    ],
    "extraction_method": "step-by-step search process",
    "verification_notes": "cross-references checked",
    "ambiguities": "unclear points or assumptions",
    "conversion_rationale": "how/why you converted the language"
  }
}`;

export const SOURCE_REASONING_SUFFIX = `

CRITICAL INSTRUCTION - SOURCE DOCUMENTATION:
You MUST provide detailed source information to help writers verify your answer. Your response MUST use this exact structure:

{
  "data": { 
    ... your normal JSON response with the requested fields ...
  },
  "source_reasoning": {
    "primary_sources": [
      {
        "document": "exact filename (e.g., Protocol_v2.3.docx)",
        "page": "specific page number(s) where you found this information (e.g., '5', '12-14', 'page 23')",
        "section": "section heading or name (e.g., '3.2 Study Design', 'Inclusion Criteria', 'Table of Contents')",
        "table": "table number and caption if data came from a table (e.g., 'Table 3: Baseline Demographics', 'Table 1 in Section 4')",
        "location_details": "precise location within the section (e.g., 'Row 3, Column 2', 'Third paragraph', 'Bullet point 5')",
        "reason": "explain why you chose this source as the most authoritative or relevant",
        "confidence": "high, medium, or low - based on how clear and explicit the information was"
      }
    ],
    "extraction_method": "describe step-by-step how you searched for and found this information using file_search",
    "verification_notes": "explain any cross-references you checked or how you validated the answer across multiple locations",
    "ambiguities": "note any unclear points, assumptions you made, or conflicting information found"
  }
}

EXAMPLE - Good response:
{
  "data": {
    "primary_outcome": "Change in HbA1c from baseline to week 24",
    "timeframe": "Baseline to Week 24"
  },
  "source_reasoning": {
    "primary_sources": [
      {
        "document": "Protocol_ABC123_v3.docx",
        "page": "18",
        "section": "6.2 Primary Efficacy Endpoint",
        "table": "Table 4: Study Endpoints",
        "location_details": "First row under 'Primary Endpoint' heading, explicitly states HbA1c change",
        "reason": "This is the official endpoint definition in the protocol's efficacy section, most authoritative source",
        "confidence": "high"
      },
      {
        "document": "Protocol_ABC123_v3.docx",
        "page": "45",
        "section": "9.1 Statistical Analysis Plan",
        "table": null,
        "location_details": "Second paragraph confirms primary endpoint and timeframe",
        "reason": "Statistical section confirms the endpoint definition from section 6.2",
        "confidence": "high"
      }
    ],
    "extraction_method": "Used file_search with query 'primary outcome endpoint'. Found explicit definition in Section 6.2 (page 18) within Table 4. Cross-referenced with statistical analysis plan on page 45 to confirm timeframe.",
    "verification_notes": "Checked 3 locations: Table 4 (p.18), Statistical Plan (p.45), and Study Schema (p.12). All consistently state HbA1c at week 24 as primary endpoint.",
    "ambiguities": "None - the primary endpoint is clearly and consistently defined throughout the protocol."
  }
}

REMEMBER: 
- The "data" field goes into the Word document
- The "source_reasoning" field is ONLY shown in the UI to help writers verify
- Be as specific as possible with page numbers, table numbers, and section names
- Always include multiple sources if you found the information in multiple places
`;

/**
 * Build 2-agent extraction prompt
 */
export function buildTwoAgentExtractionPrompt(
  userRequest: string,
  vectorStoreContext?: string,
  targetAudience?: string
): { agent1: string; agent2: string } {
  const agent1Prompt = `
${userRequest}

AGENT 1 TASK - RETRIEVAL:
Use file_search to locate and extract EXACT data from documents.
Focus on accuracy and complete source documentation.

${SOURCE_REASONING_SUFFIX}

Return raw scientific data with all source locations.`;

  const agent2Prompt = `
Based on the following raw extraction from Agent 1, convert to plain language appropriate for: ${targetAudience || 'general audience'}

${vectorStoreContext ? `\nVector Store Context for wording:\n${vectorStoreContext}\n` : ''}

AGENT 2 TASK - CONVERSION:
1. Convert scientific terminology to plain language
2. Preserve ALL source information from Agent 1
3. Maintain data accuracy while improving clarity
4. Use relatable examples where helpful

${SOURCE_REASONING_SUFFIX}

Return plain language version with complete source documentation.`;

  return { agent1: agent1Prompt, agent2: agent2Prompt };
}

/**
 * Validate source reasoning structure
 */
export interface SourceReference {
  document: string;
  page: string;
  section: string;
  table: string | null;
  location_details: string;
  exact_quote?: string;
  reason?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface SourceReasoning {
  primary_sources: SourceReference[];
  extraction_method: string;
  verification_notes: string;
  ambiguities: string;
  conversion_rationale?: string;
}

export interface ExtractedWithReasoning {
  data: Record<string, unknown>;
  source_reasoning: SourceReasoning;
}

export function validateSourceReasoning(response: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!response || typeof response !== 'object') {
    errors.push('Response is not an object');
    return { valid: false, errors };
  }

  const resp = response as Record<string, unknown>;

  if (!resp.data) {
    errors.push('Missing "data" field');
  }

  if (!resp.source_reasoning) {
    errors.push('Missing "source_reasoning" field');
    return { valid: false, errors };
  }

  const sr = resp.source_reasoning as Record<string, unknown>;

  if (!Array.isArray(sr.primary_sources) || sr.primary_sources.length === 0) {
    errors.push('primary_sources must be non-empty array');
  }

  if (typeof sr.extraction_method !== 'string' || sr.extraction_method.trim().length === 0) {
    errors.push('extraction_method must be non-empty string');
  }

  if (typeof sr.verification_notes !== 'string') {
    errors.push('verification_notes must be string');
  }

  if (typeof sr.ambiguities !== 'string') {
    errors.push('ambiguities must be string');
  }

  // Validate each source
  if (Array.isArray(sr.primary_sources)) {
    for (let i = 0; i < sr.primary_sources.length; i++) {
      const source = sr.primary_sources[i] as Record<string, unknown>;
      
      if (!source.document || typeof source.document !== 'string') {
        errors.push(`Source ${i}: missing or invalid document`);
      }
      if (!source.page || typeof source.page !== 'string') {
        errors.push(`Source ${i}: missing or invalid page`);
      }
      if (typeof source.confidence !== 'string' || !['high', 'medium', 'low'].includes(source.confidence)) {
        errors.push(`Source ${i}: invalid confidence level`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
