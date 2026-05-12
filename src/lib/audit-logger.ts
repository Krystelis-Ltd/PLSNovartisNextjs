import { NextRequest } from "next/server";
import { getUserIdentity } from "@/lib/auth";

export type AuditAction =
  | "FILE_UPLOAD"
  | "FILE_DOWNLOAD"
  | "VIEW_DASHBOARD"
  | "DATA_EXTRACT"
  | "DATA_REFINE"
  | "DATA_VALIDATE"
  | "CHAT_MESSAGE"
  | "CLIENT_EVENT"
  | "VECTOR_STORE_CLEANUP"
  | "SYSTEM_ERROR";

export interface AuditResource {
  type: "file" | "API" | "dashboard" | "vectorStore" | "client" | "batch";
  name?: string;
  id?: string;
  size?: number;
  hash?: string;
  path?: string;
}

export interface AuditStatus {
  code: number;
  result: "SUCCESS" | "FAILURE";
}

export interface AuditLogParams {
  request: NextRequest;
  action: AuditAction;
  resource: AuditResource;
  status: AuditStatus;
  details?: any;
}

let fallbackCounter = 0;

export function auditLog({
  request,
  action,
  resource,
  status,
  details,
}: AuditLogParams) {
  const user = getUserIdentity(request);

  // Attempt standard UUID, fallback to sequential counter if unavailable
  let fallbackId = `fb-${Date.now()}-${fallbackCounter++}`;
  let uuid = fallbackId;
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      uuid = crypto.randomUUID();
    }
  } catch {
    // ignore
  }

  // Extract headers
  const sessionId =
    request.headers.get("x-session-id") || `sess_${uuid.substring(0, 8)}`;
  const correlationId =
    request.headers.get("x-correlation-id") || `corr_${uuid.substring(0, 8)}`;

  // Securely extract public IP
  const azureClientIp = request.headers.get("x-azure-clientip");
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedForLast = forwardedFor
    ? forwardedFor.split(",").pop()?.trim()
    : null;
  const publicIp = azureClientIp || forwardedForLast || "unknown";

  const userAgent = request.headers.get("user-agent") || "unknown";

  let endpoint = "unknown";
  try {
    endpoint = new URL(request.url).pathname;
  } catch {
    endpoint = request.url;
  }

  const logEntry = {
    type: "AUDIT",
    timestamp: new Date().toISOString(),
    user: user,
    session_id: sessionId,
    correlation_id: correlationId,
    public_ip: publicIp,
    action: action,
    resource: resource,
    request: {
      method: request.method || "UNKNOWN",
      endpoint: endpoint,
      user_agent: userAgent,
    },
    status: status,
    ...(details && { details }),
  };

  // Print as a single line JSON string for structured logging tools to ingest
  console.log(JSON.stringify(logEntry));

  // If it's a failure (code >= 400), we also log it to console.error
  if (status.code >= 400) {
    console.error(JSON.stringify(logEntry));
  }
}

export function timedAuditLog(
  request: NextRequest,
  category: string,
  eventName: string,
  initialDetails: any = {},
) {
  const startTime = Date.now();
  return {
    finish: (finalDetails: any) => {
      const durationMs = Date.now() - startTime;
      const statusCode = finalDetails?.status || 500;
      const result = statusCode >= 400 ? "FAILURE" : "SUCCESS";

      let action: AuditAction = "CLIENT_EVENT";
      if (category === "chat") action = "CHAT_MESSAGE";

      let path = "unknown";
      try {
        path = new URL(request.url).pathname;
      } catch {
        path = request.url;
      }

      auditLog({
        request,
        action,
        resource: { type: "API", path },
        status: { code: statusCode, result },
        details: {
          category,
          event_name: eventName,
          duration_ms: durationMs,
          ...initialDetails,
          ...finalDetails,
        },
      });
    },
  };
}
