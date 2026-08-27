import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { users } from './user.schema.js';

/** Leave requests (old Mongo `LeaveRequest` collection). */
export const leaveRequests = pgTable('leave_requests', {
  id: primaryId(),
  user: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  leaveType: text('leave_type').notNull(), // CASUAL | SICK | EARNED
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('PENDING'),
  adminFeedback: text('admin_feedback'),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  ...timestamps,
});

export type LeaveRequestRow = typeof leaveRequests.$inferSelect;
export type NewLeaveRequestRow = typeof leaveRequests.$inferInsert;
