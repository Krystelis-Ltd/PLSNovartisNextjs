## 2024-05-13 - Insecure IP Extraction in Azure App Service environments
**Vulnerability:** IP spoofing risk due to relying on the first entry of `X-Forwarded-For` or `X-Real-IP`.
**Learning:** In Azure environments, the proxy appends the true client IP to the end of the `X-Forwarded-For` list. Trusting the first entry allows users to spoof their IP address. Additionally, `X-Azure-ClientIP` is a verified header in this environment.
**Prevention:** Always prioritize `X-Azure-ClientIP`. If unavailable, take the **last** entry of the comma-separated `X-Forwarded-For` list, not the first or the entire string.
