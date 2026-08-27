import { integer, pgTable, text } from 'drizzle-orm/pg-core';

/**
 * Sequence counters (replaces the Mongo `Counter` collection). Keyed by a
 * string name (e.g. 'employeeId'); `seq` is bumped atomically to mint IDs.
 */
export const counters = pgTable('counters', {
  id: text('id').primaryKey(), // e.g. 'employeeId'
  seq: integer('seq').notNull().default(0),
});

export type CounterRow = typeof counters.$inferSelect;
export type NewCounterRow = typeof counters.$inferInsert;
