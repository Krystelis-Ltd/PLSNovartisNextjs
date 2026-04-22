## 2025-02-14 - Fix insecure identifier generation in audit logs
**Vulnerability:** Weak random number generation (`Math.random()`) used as fallback for audit log identifiers.
**Learning:** `Math.random()` is cryptographically insecure and predictable. Using it for sensitive identifiers like session or correlation IDs introduces risks.
**Prevention:** Always use cryptographically secure methods like `crypto.randomUUID()` or `crypto.getRandomValues()`. If pseudo-random generation is unavoidable as a last resort, explicitly mark it (e.g., with a `legacy-` prefix) to clearly identify potentially insecure identifiers.
