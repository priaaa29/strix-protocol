/**
 * Tiny bounded-retry wrapper for Soroban RPC calls.
 *
 * Audit finding #14: the indexer / API endpoints used to fire-and-forget
 * against the RPC, so a single 429 or transient 5xx flushed an entire
 * 30-second window of events. This wrapper retries with full jitter
 * backoff (250ms base, doubling, cap at 4s) up to 3 attempts, then
 * surfaces the error to the caller so the next interval picks up.
 *
 * Distinguishes transient (429 / 5xx / network errors) from permanent
 * (4xx other than 429) errors — permanent errors don't retry.
 */

const BASE_DELAY_MS = 250;
const MAX_DELAY_MS = 4000;
const MAX_ATTEMPTS = 3;

function isTransient(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  // Treat fetch/network failures, timeouts, 429, and 5xx as transient.
  if (/timeout|ECONNRESET|ECONNREFUSED|ENOTFOUND|fetch failed|network/i.test(msg)) return true;
  if (/\b(429|5\d\d)\b/.test(msg)) return true;
  // Stellar RPC sometimes wraps errors in { code: -32xxx, message: ... }
  if (typeof err === 'object' && 'code' in (err as Record<string, unknown>)) {
    const code = (err as { code: unknown }).code;
    if (typeof code === 'number' && code >= -32099 && code <= -32000) return true;
  }
  return false;
}

function backoff(attempt: number): number {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  // Full jitter — picks a value in [0, exp). Removes the herd effect when
  // many callers retry in lockstep.
  return Math.floor(Math.random() * exp);
}

export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  onAttemptFailed?: (attempt: number, err: unknown) => void
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === MAX_ATTEMPTS - 1) {
        throw err;
      }
      const wait = backoff(attempt);
      onAttemptFailed?.(attempt + 1, err);
      // Log lightly — full backoff loops shouldn't spam stdout
      if (attempt === 0) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[rpc-retry:${label}] attempt 1 failed (${msg.slice(0, 80)}), retrying`);
      }
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}
