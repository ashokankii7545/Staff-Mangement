import { RateLimitError } from '../errors/app.errors.js';

interface Bucket {
  start: number;
  count: number;
  windowMs: number;
}

export interface RateLimitOptions {
  max?: number;
  windowMs?: number;
}

const buckets = new Map<string, Bucket>();

// Prune stale buckets hourly so the map never grows unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now - entry.start > entry.windowMs) buckets.delete(key);
  }
}, 60 * 60 * 1000).unref?.();

/**
 * Lightweight in-memory sliding-window rate limiter (no external deps).
 * Protects auth mutations (login / googleLogin / signup) from brute force.
 */
export const checkRateLimit = (key: string, options: RateLimitOptions = {}): void => {
  const { max = 12, windowMs = 15 * 60 * 1000 } = options;
  const now = Date.now();
  let entry = buckets.get(key);

  if (!entry || now - entry.start > windowMs) {
    buckets.set(key, { start: now, count: 1, windowMs });
    return;
  }

  entry.count += 1;
  if (entry.count > max) {
    throw new RateLimitError();
  }
};
