import OpenAI from 'openai';

/**
 * Lazily instantiated OpenAI client singleton.
 * The API key is read from `process.env.OPENAI_API_KEY` only when
 * `getOpenAIClient()` is first called at runtime — never at build time.
 */

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY environment variable is not set. ' +
        'Please add it to your .env.local file. See .env.example for reference.'
      );
    }
    _client = new OpenAI({ apiKey, timeout: 120_000, maxRetries: 2 });
  }
  return _client;
}
