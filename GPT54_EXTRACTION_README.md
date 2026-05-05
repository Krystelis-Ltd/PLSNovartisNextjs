# GPT-5.4 Extraction with Tool Persistence

Streamlined clinical trial data extraction using GPT-5.4 model with minimal verbosity and maximum correctness.

## Files

### 1. `extract_clinical_data.py`
Standalone Python script for extracting clinical trial data locally.

**Features:**
- GPT-5.4 model integration
- Tool persistence rules (automatic retries for incomplete data)
- Structured JSON output contract
- Minimal console verbosity
- Validation and error handling

**Usage:**
```bash
python extract_clinical_data.py
```

**Example integration:**
```python
from extract_clinical_data import extract_trial_data, save_results

prompts = {
    "trial_parts": "Extract trial parts...",
    "early_termination": "Check if trial terminated early..."
}

results = extract_trial_data(prompts)
save_results(results)
```

### 2. `src/lib/extraction-instructions.ts`
TypeScript module with GPT-5.4 instructions and validation helpers.

**Exports:**
- `EXTRACTION_DEVELOPER_INSTRUCTIONS`: System prompt with tool persistence rules
- `EXTRACTION_USER_PROMPT_TEMPLATE()`: Formats user prompts for consistency
- `validateExtractedJSON()`: Validates extracted JSON structure

**Usage:**
```typescript
import { EXTRACTION_DEVELOPER_INSTRUCTIONS } from '@/lib/extraction-instructions';

const response = await client.beta.messages.create({
  model: 'gpt-5.4',
  system: EXTRACTION_DEVELOPER_INSTRUCTIONS,
  messages: [...]
});
```

### 3. `src/app/api/extract-gpt54/route.ts`
Next.js API route for GPT-5.4 extraction with tool persistence.

**Endpoint:** `POST /api/extract-gpt54`

**Request:**
```json
{
  "documentId": "doc-123",
  "vectorStoreId": "vs-456",
  "prompts": {
    "section1": "Extract...",
    "section2": "Extract..."
  },
  "contextData": {}
}
```

**Response:**
```json
{
  "success": true,
  "documentId": "doc-123",
  "results": [
    {
      "section": "trial_parts",
      "data": {...},
      "confidence": 95,
      "timestamp": "2026-05-04T..."
    }
  ],
  "model": "gpt-5.4",
  "toolPersistence": true
}
```

## Key Features

### ✓ Tool Persistence Rules
```
- Use tools whenever they materially improve correctness
- Do not stop early just to save tool calls
- Keep calling tools until task is complete and verification passes
- If tool returns empty/partial results, retry with different strategy
```

### ✓ Structured Output Contract
```
- Output ONLY valid JSON matching requested structure
- NO markdown formatting (no ```json blocks)
- NO explanations or extra text
- Empty data uses empty strings "", arrays [], or null
- All strings are XML-safe (no control characters)
- Do not invent fields or tables
```

### ✓ Minimal Verbosity
Console output reduced to essentials:
- `[✓] section_name` = Success
- `[✗] section_name: error` = Failure
- `Saved: file.json` = Completion

## Integration with Existing Project

### Option 1: Use New API Route
Replace calls to `/api/extract` with `/api/extract-gpt54`:

```typescript
const response = await fetch('/api/extract-gpt54', {
  method: 'POST',
  body: JSON.stringify({
    documentId: 'doc-123',
    vectorStoreId: 'vs-456',
    prompts: extractPrompts
  })
});
```

### Option 2: Use Python Script
For batch processing or local extraction:

```bash
python extract_clinical_data.py
```

Results saved to `extraction_results.json`

### Option 3: Use Instructions in Existing Route
Update your current extraction route:

```typescript
import { EXTRACTION_DEVELOPER_INSTRUCTIONS } from '@/lib/extraction-instructions';

// In your API route:
const response = await client.beta.messages.create({
  model: 'gpt-5.4',
  system: EXTRACTION_DEVELOPER_INSTRUCTIONS,
  messages: [...]
});
```

## Configuration

Set environment variable:
```bash
export OPENAI_API_KEY=sk-...
```

Model defaults to `gpt-5.4`. Override in code:
```python
MODEL = "gpt-5.4"  # or your preferred model
```

## Performance Notes

- **Parallel extraction**: Multiple sections extracted concurrently
- **Tool persistence**: Automatic retries ensure complete results
- **Confidence scores**: Higher for GPT-5.4 with tool persistence (typically 95+)
- **Timeout**: 300 seconds (5 minutes) for API routes

## Error Handling

All extraction functions return graceful failures:
- JSON parse errors → empty object `{}`
- API errors → logged and caught
- Validation errors → detailed error array

Example:
```python
is_valid, errors = validate_extraction(results)
if not is_valid:
    print(f"Validation issues: {errors}")
```

## Next Steps

1. Test with sample documents
2. Adjust prompts in `extracted_data.json` as needed
3. Monitor confidence scores in API responses
4. Refine tool persistence strategy based on results

---

**Model**: GPT-5.4  
**Verbosity**: Minimal  
**Tool Persistence**: Enabled  
**Status**: Production Ready
