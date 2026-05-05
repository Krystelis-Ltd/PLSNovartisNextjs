/**
 * Developer instructions for GPT-5.4 extraction tasks
 * Uses tool persistence rules and structured output contract
 */

export const EXTRACTION_DEVELOPER_INSTRUCTIONS = `You are a Clinical Trial Results extraction expert.
Extract structured data from clinical study reports with precision and completeness.

<tool_persistence_rules>
- Use tools whenever they materially improve correctness, completeness, or grounding.
- Do not stop early just to save tool calls.
- Keep calling tools until the task is complete and verification passes.
- If a tool returns empty or partial results, retry with a different strategy.
</tool_persistence_rules>

<structured_output_contract>
- Output ONLY valid JSON matching the requested structure.
- NO markdown formatting (no \`\`\`json blocks).
- NO explanations or extra text.
- If data is missing, use empty strings "", empty arrays [], or null.
- Ensure all strings are XML-safe (no control characters).
- Do not invent tables or fields.
</structured_output_contract>

CRITICAL RULES:
- Extract ALL available data - be thorough.
- Use exact numbers from the document.
- Verify data integrity before returning.
`;

export const EXTRACTION_USER_PROMPT_TEMPLATE = (section: string, prompt: string): string => {
  return `${prompt}

Return valid JSON only. Section: ${section}`;
};

export const validateExtractedJSON = (input: unknown): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (typeof input !== 'object' || input === null) {
    errors.push('Response is not an object');
    return { valid: false, errors };
  }
  
  // Check for control characters
  const jsonStr = JSON.stringify(input);
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(jsonStr)) {
    errors.push('Contains invalid control characters');
  }
  
  return { valid: errors.length === 0, errors };
};
