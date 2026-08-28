import { index, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { users } from './user.schema.js';

/**
 * Payroll records – employer/HR-managed. Staff never create these; an admin
 * fills the salary details per month and the staff member sees them read-only
 * in their profile (Workday-style payslip record, not a file upload).
 */
export const salaryRecords = pgTable(
  'salary_records',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Payroll month in `YYYY-MM` format. */
    month: text('month').notNull(),
    basic: numeric('basic', { precision: 12, scale: 2 }).notNull().default('0'),
    hra: numeric('hra', { precision: 12, scale: 2 }).notNull().default('0'),
    allowances: numeric('allowances', { precision: 12, scale: 2 }).notNull().default('0'),
    deductions: numeric('deductions', { precision: 12, scale: 2 }).notNull().default('0'),
    /** Server-computed: basic + hra + allowances - deductions. */
    netPay: numeric('net_pay', { precision: 12, scale: 2 }).notNull().default('0'),
    notes: text('notes').notNull().default(''),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => ({
    userMonthIdx: index('salary_records_user_month_idx').on(t.userId, t.month),
  }),
);

/** One-time bonus payments (festival/performance) – admin-managed. */
export const bonusRecords = pgTable(
  'bonus_records',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Bonus month in `YYYY-MM` format. */
    month: text('month').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull().default('0'),
    reason: text('reason').notNull().default(''),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => ({
    userMonthIdx: index('bonus_records_user_month_idx').on(t.userId, t.month),
  }),
);

export type SalaryRow = typeof salaryRecords.$inferSelect;
export type NewSalaryRow = typeof salaryRecords.$inferInsert;
export type BonusRow = typeof bonusRecords.$inferSelect;
export type NewBonusRow = typeof bonusRecords.$inferInsert;
