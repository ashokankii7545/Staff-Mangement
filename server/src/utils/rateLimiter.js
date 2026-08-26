import { GraphQLError } from 'graphql';

/**
 * Lightweight in-memory sliding-window rate limiter (no external deps).
 * Protects auth mutations (login / googleLogin / signup) from brute force.
 */
const buckets = new Map();

// Prune stale buckets every hour so the map never grows unbounded
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now - entry.start > entry.windowMs) buckets.delete(key);
  }
}, 60 * 60 * 1000).unref?.();

export const checkRateLimit = (key, { max = 12, windowMs = 15 * 60 * 1000 } = {}) => {
  const now = Date.now();
  let entry = buckets.get(key);

  if (!entry || now - entry.start > windowMs) {
    buckets.set(key, { start: now, count: 1, windowMs });
    return;
  }

  entry.count += 1;
  if (entry.count > max) {
    throw new GraphQLError('Too many attempts. Please try again in a few minutes.', {
      extensions: { code: 'TOO_MANY_ATTEMPTS' },
    });
  }
};
