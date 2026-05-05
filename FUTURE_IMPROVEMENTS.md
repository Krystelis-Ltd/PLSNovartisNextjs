# Future Improvements Roadmap

## 1. Real-Time Streaming Extraction (SSE)

**Problem:** Users stare at loading spinners for 60-120s per extraction batch with no visibility into progress.

**Solution:** Replace standard HTTP request/response with Server-Sent Events (SSE) or Next.js streaming responses.

**Implementation:**
- Convert `/api/extract` to return a `ReadableStream` using `new Response(stream)`
- Use the OpenAI streaming API (`stream: true`) to pipe tokens as they arrive
- Frontend uses `EventSource` or `fetch` with `response.body.getReader()` to display tokens as they arrive
- Each token chunk updates the corresponding `ExtractionFeedItem` in real-time

**Impact:** Reduces perceived extraction time from 90s → ~5s (first token appears almost immediately).

---

## 2. Persistent Database Storage (PostgreSQL / Supabase)

**Problem:** If a user refreshes the browser during extraction, all progress is lost. No audit trail of completed extractions.

**Solution:** Introduce an `ExtractionSession` concept backed by a database.

**Schema:**
```sql
CREATE TABLE extraction_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  vector_store_id TEXT,
  mapping_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'in_progress' -- in_progress, completed, failed
);

CREATE TABLE extraction_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES extraction_sessions(id),
  key_name TEXT NOT NULL,
  raw_data JSONB,
  refined_data JSONB,
  source_reasoning JSONB,
  confidence_score INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE extraction_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID REFERENCES extraction_results(id),
  document TEXT,
  page TEXT,
  section TEXT,
  table_ref TEXT,
  location_details TEXT,
  reason TEXT,
  confidence TEXT -- 'high', 'medium', 'low'
);
```

**Impact:** Session recovery, audit compliance, analytics dashboard potential.

---

## 3. Multi-User Collaborative Editing (Liveblocks / Yjs)

**Problem:** Medical writing for PLS/protocols is a team effort (writers, SMEs, reviewers). Currently single-user only.

**Solution:** Integrate real-time collaboration using Liveblocks or Yjs.

**Implementation:**
- Each `ExtractionSession` becomes a shared room
- The `JsonEditor` component wraps its state in a Yjs document
- Multiple users see each other's cursors and edits in real-time
- Comments/annotations per extracted field
- "Approve & Lock" workflow where SMEs can sign off on individual fields

**Dependencies:** Liveblocks ($25/mo) or self-hosted Yjs (free, more complex).

---

## 4. Deterministic Hallucination Detection (Red Team Script)

**Problem:** AI may fabricate numbers or statistics that don't exist in the source document.

**Solution:** A local, non-AI verification script that mathematically validates extracted data.

**Implementation:**
```typescript
function validateExtraction(data: Record<string, any>, sourceQuote: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  
  // Extract all numbers from the source quote
  const sourceNumbers = extractNumbers(sourceQuote);
  
  // Extract all numbers from the AI output
  const outputNumbers = extractNumbers(JSON.stringify(data));
  
  // Flag any output number not found in the source
  for (const num of outputNumbers) {
    if (!sourceNumbers.includes(num)) {
      issues.push({
        type: 'POTENTIAL_HALLUCINATION',
        severity: 'critical',
        value: num,
        message: `Number "${num}" appears in AI output but not in source text`
      });
    }
  }
  
  return { valid: issues.length === 0, issues };
}
```

**Impact:** Deterministic (not AI-dependent) safety net for numerical accuracy.

---

## 5. Export Audit Report

**Problem:** Pharma regulatory teams need a full audit trail of who extracted what, when, and from which source.

**Solution:** Generate an "Extraction Audit Report" alongside the Word document.

**Content:**
- Session timestamp, user ID, model versions used
- For each extracted field: source document, page, section, confidence, verification notes
- Diff between raw extraction and refined output
- Total pipeline time, cost estimate

**Format:** PDF or additional DOCX tab alongside the main document.

---

## 6. Smart Prompt Optimization

**Problem:** Some extraction prompts consistently return low-confidence results, but we have no visibility into which prompts need improvement.

**Solution:** Track confidence scores per prompt key over time and surface a "Prompt Health Dashboard."

**Implementation:**
- Store `{prompt_key, confidence_score, mapping_name}` per extraction in the database
- Dashboard page showing average confidence per prompt key
- Auto-suggest prompt rewording for keys consistently scoring below 70%

---

## Priority Matrix

| Improvement | Impact | Effort | Priority |
|---|---|---|---|
| SSE Streaming | 🟢 High | 🟡 Medium | P1 |
| Database Persistence | 🟢 High | 🔴 High | P1 |
| Hallucination Detection | 🟢 High | 🟢 Low | P2 |
| Export Audit Report | 🟡 Medium | 🟡 Medium | P2 |
| Collaborative Editing | 🟡 Medium | 🔴 High | P3 |
| Prompt Optimization | 🟡 Medium | 🟡 Medium | P3 |
