import type { WithId } from '../../shared/repository/base-repository.js';
import type { SalaryRow, BonusRow } from '../../db/schema/salary.schema.js';

/** Payroll (salary slip) record types – backed by Postgres/Drizzle. */
export interface ISalaryRecord {
  userId: string;
  month: string;
  basic: string;
  hra: string;
  allowances: string;
  deductions: string;
  netPay: string;
  notes: string;
  createdBy?: string | null;
}

/** One-time bonus record types – backed by Postgres/Drizzle. */
export interface IBonusRecord {
  userId: string;
  month: string;
  amount: string;
  reason: string;
  createdBy?: string | null;
}

export type SalaryRecordDoc = WithId<SalaryRow>;
export type BonusRecordDoc = WithId<BonusRow>;
