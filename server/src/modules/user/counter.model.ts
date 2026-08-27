import { sql } from 'drizzle-orm';
import { db } from '../../config/drizzle.js';
import { counters } from '../../db/schema/counter.schema.js';

/**
 * Counter helper (replaces the Mongo `Counter` collection). Atomically mints
 * the next value for a named sequence via an upsert + increment in one round
 * trip – equivalent to the old findOneAndUpdate({_id},{ $inc }, {upsert,new}).
 */
export const nextSequence = async (name: string): Promise<number> => {
  const rows = await db
    .insert(counters)
    .values({ id: name, seq: 1 })
    .onConflictDoUpdate({
      target: counters.id,
      set: { seq: sql`${counters.seq} + 1` },
    })
    .returning({ seq: counters.seq });
  return rows[0]?.seq ?? 1;
};
