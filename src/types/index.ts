// ─── Shared Type Definitions ───
// Centralized types to eliminate `any` usage across the codebase.

// ─── OpenAI Response Types ───

/** Shape returned by OpenAI responses.create() */
export interface OpenAIResponsePayload {
  output_text?: string;
  output?: Array<{
    type: string;
    name?: string;
    arguments?: string | Record<string, unknown>;
    content?: Array<{ text?: string }>;
  }>;
  choices?: Array<{ message?: { content?: string } }>;
}

// ─── API Request/Response Types ───

export interface ExtractRequest {
  batchPrompts: Record<string, string>;
  vectorStoreId: string;
  contextData?: Record<string, unknown>;
}

export interface RefineRequest {
  rawJson: string;
  userInstructions?: string;
  vectorStoreId?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  vectorStoreId: string;
  fetchedAnswers: Record<string, unknown>;
}

export interface ValidateRequest {
  keyName: string;
  extractedData: Record<string, unknown>;
  sourceQuote?: string;
}

export interface GenerateRequest {
  parsedData: Record<string, unknown>;
  mappingName: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface UploadStats {
  total_files_submitted: number;
  successful_uploads: number;
  success: boolean;
  failed: number;
  uploaded_file_ids: string[];
  vector_store_id: string;
  errors: string[];
}

// ─── Frontend State Types ───

export interface SourceReference {
  document: string;
  page: string;
  section: string;
  table: string | null;
  location_details: string;
  reason?: string;
  confidence: string;
}

export interface SourceReasoningData {
  primary_sources: SourceReference[];
  extraction_method: string;
  verification_notes: string;
  ambiguities: string;
}

export interface SourceModalData {
  quote?: string;
  file?: string;
  section?: string;
  page?: string;
  sourceReasoning?: SourceReasoningData;
}

export interface FileEntry {
  name: string;
  size: string;
  status: string;
  icon: string;
  statusIcon: string;
  statusColor: string;
  opacity: string;
}

export interface ExtractionFeedItem {
  title: string;
  status: 'WAITING...' | 'FETCHING...' | 'REFINING...' | 'VALIDATING...' | 'COMPLETED';
  data?: string;
  parsedObj?: unknown;
  confidenceScore?: number;
  sourceQuote?: string;
  sourceFile?: string;
  sourcePage?: string;
  sourceSection?: string;
  sourceReasoning?: SourceReasoningData;
}

// ─── Treatment Data Shape ───

export interface TreatmentGroup {
  name: string;
  participants: string | number;
}

export interface TreatmentData {
  treatment_summary: string;
  groups: TreatmentGroup[];
  total_participants: number;
}

// ─── Chart Data Shape ───

export interface ChartDataset {
  label: string;
  data: (string | number)[];
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartEndpointItem {
  question?: string;
  primary_endpoint_results_conclusion?: string;
  clinical_term_definition?: string;
  primary_endpoint_results_assessment?: string;
  Primary_endpoint_results?: string;
  chart_title?: string;
  chart_type?: string;
  data?: ChartData;
}
