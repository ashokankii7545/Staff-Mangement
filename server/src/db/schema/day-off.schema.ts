import { pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { users } from './user.schema.js';

/**
 * Day-off exemptions (old Mongo `Exemption` collection).
 * Unique {user,date} prevents granting the same day twice.
 */
export const exemptions = pgTable(
  'exemptions',
  {
    id: primaryId(),
    user: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: text('date').notNull(), // YYYY-MM-DD
    reason: text('reason').notNull().default(''),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => ({
    userDateUnique: uniqueIndex('exemptions_user_date_unique').on(t.user, t.date),
  }),
);

export type ExemptionRow = typeof exemptions.$inferSelect;
export type NewExemptionRow = typeof exemptions.$inferInsert;
