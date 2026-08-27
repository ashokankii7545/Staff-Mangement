import { describe, it, expect, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { nextSequence } from './counter.model.js';
import { counters } from '../../db/schema/index.js';
import { db } from '../../config/drizzle.js';

const NAME = `test-seq-${Date.now()}`;

afterAll(async () => {
  await db.delete(counters).where(eq(counters.id, NAME));
});

describe('nextSequence (counters table)', () => {
  it('starts at 1 and increments atomically', async () => {
    expect(await nextSequence(NAME)).toBe(1);
    expect(await nextSequence(NAME)).toBe(2);
    expect(await nextSequence(NAME)).toBe(3);
  });

  it('is race-proof under concurrency (no duplicate values)', async () => {
    const name = `${NAME}-conc`;
    const results = await Promise.all(Array.from({ length: 10 }, () => nextSequence(name)));
    const unique = new Set(results);
    expect(unique.size).toBe(10); // all distinct
    expect(Math.max(...results)).toBe(10);
    await db.delete(counters).where(eq(counters.id, name));
  });
});
