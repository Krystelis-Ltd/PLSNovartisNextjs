## 2024-05-17 - Secure IP Address Extraction
**Vulnerability:** Insecure client IP extraction in `src/lib/audit-logger.ts` relying blindly on `x-forwarded-for` or `x-real-ip` which can be easily spoofed.
**Learning:** Azure environments provide `x-azure-clientip` which is verified by the platform, whereas `x-forwarded-for` can be a comma-separated list where the client can spoof the first entry.
**Prevention:** Always prioritize trusted platform headers (`x-azure-clientip`), and if relying on `x-forwarded-for` extract the LAST entry in the list which is typically appended by the closest proxy rather than the first.
