## 2024-05-24 - [Insecure Randomness & IP Extraction]
**Vulnerability:** Weak pseudo-random number generation (`Math.random()`) used for generating security-sensitive Audit Log IDs (`sessionId`, `correlationId`). Insecure extraction of the client's public IP from the `x-forwarded-for` array.
**Learning:** `Math.random()` provides predictable IDs which can be exploited, and naive IP extraction is prone to spoofing.
**Prevention:** Use `crypto.randomUUID()` with a safe `crypto.randomBytes(16).toString('hex')` fallback for identifiers. For extracting client IPs, prioritize a trusted proxy header (like `x-azure-clientip`) and if parsing `x-forwarded-for`, strictly use the last entry which represents the IP appended by the proxy.
