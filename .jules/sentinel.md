## 2025-02-14 - Information Disclosure in API Routes
**Vulnerability:** API routes were leaking internal error messages and potentially stack traces to clients by returning `details: msg` in 500 error responses.
**Learning:** Detailed error messages can inadvertently expose sensitive internal infrastructure details, API keys, or logic paths to attackers. They should be logged securely on the server-side, while clients should receive generic failure messages.
**Prevention:** Always follow a secure-fail pattern by returning generic error messages in the JSON payload sent to clients and keeping detailed logs restricted to the server environment via logging utilities.
