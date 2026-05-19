## 2024-05-24 - IP Spoofing and UUID Collision in Audit Logger
**Vulnerability:** IP spoofing via  and , and potential log collisions due to heavily truncated UUIDs.
**Learning:** Taking the raw `X-Forwarded-For` header allows for IP spoofing because malicious clients could send this header with fake IPs. By splitting the header and taking the *last* IP, the application correctly extracts the IP address appended by the immediate, trusted reverse proxy. Truncating a UUID to 8 characters reduces entropy to ~32 bits, increasing the risk of log collisions.
**Prevention:** Always extract the last entry of `X-Forwarded-For` and prioritize trusted headers like `X-Azure-ClientIP`. Avoid truncating UUIDs used for uniqueness.
## 2024-05-24 - IP Spoofing and UUID Collision in Audit Logger
**Vulnerability:** IP spoofing via X-Forwarded-For and X-Real-IP, and potential log collisions due to heavily truncated UUIDs.
**Learning:** Taking the raw X-Forwarded-For header allows for IP spoofing because malicious clients could send this header with fake IPs. By splitting the header and taking the *last* IP, the application correctly extracts the IP address appended by the immediate, trusted reverse proxy. Truncating a UUID to 8 characters reduces entropy to ~32 bits, increasing the risk of log collisions.
**Prevention:** Always extract the last entry of X-Forwarded-For and prioritize trusted headers like X-Azure-ClientIP. Avoid truncating UUIDs used for uniqueness.
