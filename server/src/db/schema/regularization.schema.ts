import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { users } from './user.schema.js';

/** Punch-correction requests for a past day (old Mongo `Regularization`). */
export const regularizations = pgTable('regularizations', {
  id: primaryId(),
  user: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
  checkInTime: text('check_in_time').notNull(),
  checkOutTime: text('check_out_time').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('PENDING'),
  adminFeedback: text('admin_feedback'),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  ...timestamps,
});

export type RegularizationRow = typeof regularizations.$inferSelect;
export type NewRegularizationRow = typeof regularizations.$inferInsert;
