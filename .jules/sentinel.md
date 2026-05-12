## 2024-05-20 - [Fix IP Spoofing in Azure Environments]
**Vulnerability:** Insecure extraction of the client's public IP address in `audit-logger.ts`. It was incorrectly using the entire `x-forwarded-for` header or falling back to `x-real-ip`.
**Learning:** `x-forwarded-for` is a comma-separated list where the client can spoof the first entry. Relying on it directly without processing or relying on `x-real-ip` allows IP spoofing. In Azure App Service environments, `X-Azure-ClientIP` is verified, and the last entry of `x-forwarded-for` is the true IP appended by the proxy.
**Prevention:** Prioritize `X-Azure-ClientIP` or the last entry of the `x-forwarded-for` header to prevent IP spoofing in environments like Azure App Service.
