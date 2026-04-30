## 2025-02-14 - Fix IP spoofing and log injection in audit logger
**Vulnerability:** Audit logger blindly trusted `X-Forwarded-For` and `X-Real-IP` headers directly and logged them without sanitization.
**Learning:** `X-Forwarded-For` can be spoofed by clients and can contain multiple IPs. Taking the first IP is insecure if the client spoofs it. Also, logging headers without stripping newlines creates Log Injection (CRLF) vulnerabilities.
**Prevention:** In environments like Azure, prioritize `X-Azure-ClientIP`. For `X-Forwarded-For`, always take the *last* appended IP (which is added by the trusted proxy/load balancer). Strip all carriage returns (`\r\n`) and enforce a max length (e.g., 45 for IPv6) before logging.
