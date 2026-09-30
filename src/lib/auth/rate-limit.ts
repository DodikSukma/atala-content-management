import "server-only";

/**
 * Pembatas percobaan login sederhana di memori (per instance server).
 * Cukup untuk satu admin; di Vercel tiap instance punya hitungan sendiri.
 */
export type RateLimiter = {
  isLimited(key: string, now?: number): boolean;
  recordFailure(key: string, now?: number): void;
  reset(key: string): void;
};

type Entry = { failures: number[] };

export function createRateLimiter({ max, windowMs }: { max: number; windowMs: number }): RateLimiter {
  const entries = new Map<string, Entry>();

  function prune(key: string, now: number): Entry | undefined {
    const entry = entries.get(key);
    if (!entry) return undefined;
    entry.failures = entry.failures.filter((time) => now - time < windowMs);
    if (entry.failures.length === 0) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  }

  function sweep(now: number) {
    if (entries.size < 500) return;
    for (const key of [...entries.keys()]) prune(key, now);
  }

  return {
    isLimited(key, now = Date.now()) {
      const entry = prune(key, now);
      return (entry?.failures.length ?? 0) >= max;
    },
    recordFailure(key, now = Date.now()) {
      sweep(now);
      const entry = prune(key, now) ?? { failures: [] };
      entry.failures.push(now);
      entries.set(key, entry);
    },
    reset(key) {
      entries.delete(key);
    },
  };
}

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 5 * 60 * 1000;

const globalForLimiter = globalThis as unknown as { __atalaLoginLimiter?: RateLimiter };

/** Instance bersama (bertahan saat hot reload pengembangan). */
export const loginRateLimiter: RateLimiter =
  globalForLimiter.__atalaLoginLimiter ??
  (globalForLimiter.__atalaLoginLimiter = createRateLimiter({ max: LOGIN_MAX_FAILURES, windowMs: LOGIN_WINDOW_MS }));
