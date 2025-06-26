import { sleep } from './sleep';
import logger from './logger';

// Ensures only one live request to the protected endpoint is in-flight per browser tab.
let requestInFlight = false;

/**
 * Fetch wrapper that (a) serialises concurrent calls so only one request
 * is active at a time and (b) retries HTTP 429 responses with exponential
 * back-off (plus random jitter).
 *
 * The wrapper is intentionally simple and generic so it can be re-used for
 * any endpoint that needs this protection (currently /api/doubao).
 *
 * @param input   Same as the first argument to window.fetch
 * @param init    Same as the second argument to window.fetch
 * @param maxRetries   How many times to retry after a 429. Default = 3.
 */
export const throttledFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  maxRetries = 3
): Promise<Response> => {
  let attempt = 0;

  while (true) {
    // ── SERIALISE ──────────────────────────────────────────────
    // Wait until any previous request has finished.
    while (requestInFlight) {
      await sleep(100); // small poll interval
    }

    // Mark this request as "in-flight" so others will queue up.
    requestInFlight = true;

    try {
      const response = await fetch(input, init);

      // No throttling response → return immediately.
      if (response.status !== 429) {
        return response;
      }

      // Handle HTTP 429 Too Many Requests
      if (attempt >= maxRetries - 1) {
        // Exhausted retries – return the 429 response so caller can decide.
        logger.warn(`Exceeded retry limit (${maxRetries}) after HTTP 429.`);
        return response;
      }

      // Calculate exponential back-off with jitter (2^attempt * 1s + 0-500 ms)
      const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 500;
      attempt += 1;

      logger.warn(
        `HTTP 429 received – retrying in ${Math.round(backoff)} ms (attempt ${attempt}/${maxRetries})...`
      );

      // Allow queued calls to proceed while we back-off
      requestInFlight = false;
      await sleep(backoff);
      continue; // Try again.
    } finally {
      // Only clear the flag if *this* try actually put it.
      if (requestInFlight) {
        requestInFlight = false;
      }
    }
  }
}; 