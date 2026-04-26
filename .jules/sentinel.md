## 2024-05-18 - [Removed Info Disclosure in API Responses]
**Vulnerability:** API routes were returning internal error details (e.g., error messages) to the client on 500 Server Errors in NextResponse.json payloads.
**Learning:** Detailed error messages can leak sensitive internal state, stack traces, file paths, or third-party service details to end users.
**Prevention:** Only log detailed error messages server-side (e.g., in audit logs or console.error). Return generic "Operation failed" or "Internal Server Error" messages to the client.
