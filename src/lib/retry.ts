/**
 * Retry-with-backoff utility for OpenAI API calls.
 * Replaces hand-rolled retry loops in extract, validate, and refine routes.
 *
 * Azure-hardened: exponential backoff with jitter to prevent thundering herd.
 */

export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms between retries (default: 2000) */
  baseDelayMs?: number;
  /** Label for log messages */
  label?: string;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 2000, label = 'Operation' } = options;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isLast = attempt === maxRetries - 1;
      const errMsg = err instanceof Error ? err.message : String(err);

      // Check for rate limit (429) or server errors (5xx) to apply longer backoff
      const isRateLimit = errMsg.includes('429') || errMsg.includes('rate limit');
      const isServerError = errMsg.includes('500') || errMsg.includes('502') || errMsg.includes('503');

      console.warn(`[${label}] Attempt ${attempt + 1}/${maxRetries} failed: ${errMsg}`);

      if (isLast) throw err;

      // Exponential backoff with jitter: base * 2^attempt + random jitter
      const backoff = isRateLimit
        ? baseDelayMs * Math.pow(3, attempt) // Aggressive backoff for rate limits
        : baseDelayMs * Math.pow(2, attempt); // Standard exponential for others
      const jitter = Math.random() * 1000;
      const delay = backoff + jitter;

      console.log(`[${label}] Retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // TypeScript requires this — unreachable in practice
  throw new Error(`${label} failed after ${maxRetries} attempts`);
}
