import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';

/** Company holidays (old Mongo `Holiday` collection). */
export const holidays = pgTable('holidays', {
  id: primaryId(),
  name: text('name').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  description: text('description').notNull().default(''),
  type: text('type').notNull().default('NATIONAL'), // NATIONAL | OPTIONAL
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

export type HolidayRow = typeof holidays.$inferSelect;
export type NewHolidayRow = typeof holidays.$inferInsert;
