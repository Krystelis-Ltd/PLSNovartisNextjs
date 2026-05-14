## 2024-05-24 - Fix IP Spoofing in Audit Logger
**Vulnerability:** Insecure client IP extraction (`X-Forwarded-For` taking the first entry or relying on `X-Real-IP`) allows attackers to spoof their IP address by injecting headers, leading to falsified audit logs.
**Learning:** In Azure App Service or similar proxy environments, `X-Forwarded-For` appends the client IP to the end, or `X-Azure-ClientIP` is provided. Taking the first entry of `X-Forwarded-For` is a security risk as it can be client-supplied.
**Prevention:** Securely extract client IPs by prioritizing trusted headers like `X-Azure-ClientIP` or parsing the last entry of `X-Forwarded-For`.
