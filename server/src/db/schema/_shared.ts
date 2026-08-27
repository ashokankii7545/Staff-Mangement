import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Shared column helpers so every table declares id + timestamps identically.
 * - `id`: uuid primary key, DB-generated (gen_random_uuid()).
 * - `createdAt` / `updatedAt`: timestamptz with now() defaults; updatedAt is
 *   also bumped app-side on updates (see BaseRepository.updateById).
 */
export const primaryId = () =>
  uuid('id').primaryKey().default(sql`gen_random_uuid()`);

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};
