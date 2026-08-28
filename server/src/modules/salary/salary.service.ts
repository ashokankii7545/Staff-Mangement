import dayjs from 'dayjs';
import { ValidationError } from '../../shared/errors/app.errors.js';
import { notificationService } from '../notification/notification.service.js';
import type { SalaryRecordDoc, BonusRecordDoc } from './salary.model.js';
import { salaryRepository } from './salary.repository.js';

export interface SalaryInputShape {
  month: string;
  basic: number;
  hra?: number;
  allowances?: number;
  deductions?: number;
  notes?: string;
}

export interface BonusInputShape {
  month: string;
  amount: number;
  reason?: string;
}

/** Payroll months are always `YYYY-MM`. */
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Non-negative finite money value or null when absent. */
const money = (v: unknown): number | null => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return round2(n);
};

const monthLabel = (month: string): string => dayjs(`${month}-01`).format('MMMM YYYY');

/** Postgres numerics come back as strings – expose plain numbers to GraphQL. */
const toSalaryDTO = (r: SalaryRecordDoc) => ({
  id: String(r._id ?? r.id),
  userId: String(r.userId),
  month: r.month,
  basic: Number(r.basic),
  hra: Number(r.hra),
  allowances: Number(r.allowances),
  deductions: Number(r.deductions),
  netPay: Number(r.netPay),
  notes: r.notes ?? '',
  createdAt: r.createdAt,
});

const toBonusDTO = (r: BonusRecordDoc) => ({
  id: String(r._id ?? r.id),
  userId: String(r.userId),
  month: r.month,
  amount: Number(r.amount),
  reason: r.reason ?? '',
  createdAt: r.createdAt,
});

/**
 * SalaryService – payroll & bonus records. Admin is the source of truth:
 * they fill the salary/bonus FORM per staff member; staff see a read-only
 * history in their profile and get notified when something is added.
 */
class SalaryService {
  private static instance: SalaryService | null = null;

  private constructor() {}

  public static getInstance(): SalaryService {
    if (!SalaryService.instance) {
      SalaryService.instance = new SalaryService();
    }
    return SalaryService.instance;
  }

  /** Staff may read their own records; admins may read anyone's. */
  public async listSalary(userId: string, requester: { id: string; role: string }) {
    if (requester.role !== 'ADMIN' && requester.id !== userId) {
      throw new ValidationError('You can only view your own salary records.');
    }
    const rows = await salaryRepository.queries.listSalaryByUser(userId);
    return rows.map(toSalaryDTO);
  }

  public async listBonus(userId: string, requester: { id: string; role: string }) {
    if (requester.role !== 'ADMIN' && requester.id !== userId) {
      throw new ValidationError('You can only view your own bonus records.');
    }
    const rows = await salaryRepository.queries.listBonusByUser(userId);
    return rows.map(toBonusDTO);
  }

  /** ADMIN fills the salary form – net pay is computed server-side. */
  public async createSalary(userId: string, input: SalaryInputShape, actorId: string) {
    const month = String(input.month || '').trim();
    if (!MONTH_RE.test(month)) throw new ValidationError('Month must be in YYYY-MM format.');

    const basic = money(input.basic);
    const hra = money(input.hra ?? 0);
    const allowances = money(input.allowances ?? 0);
    const deductions = money(input.deductions ?? 0);
    if (basic === null || hra === null || allowances === null || deductions === null) {
      throw new ValidationError('Salary amounts must be non-negative numbers.');
    }

    const netPay = round2(basic + hra + allowances - deductions);

    const row = await salaryRepository.queries.createSalary({
      userId,
      month,
      basic: String(basic),
      hra: String(hra),
      allowances: String(allowances),
      deductions: String(deductions),
      netPay: String(netPay),
      notes: String(input.notes || '').trim(),
      createdBy: actorId,
    });

    await notificationService.push({
      recipientIds: [userId],
      type: 'GENERIC',
      title: 'Salary slip added',
      message: `Salary slip for ${monthLabel(month)} has been added to your profile.`,
      link: `/staff/${userId}`,
      meta: { salaryRecordId: String(row._id) },
    });

    return toSalaryDTO(row);
  }

  public async deleteSalary(id: string) {
    const existing = await salaryRepository.queries.findSalaryById(id);
    if (!existing) throw new ValidationError('Salary record not found.');
    await salaryRepository.queries.deleteSalaryById(id);
    return true;
  }

  public async createBonus(userId: string, input: BonusInputShape, actorId: string) {
    const month = String(input.month || '').trim();
    if (!MONTH_RE.test(month)) throw new ValidationError('Month must be in YYYY-MM format.');

    const amount = money(input.amount);
    if (amount === null) throw new ValidationError('Bonus amount must be a non-negative number.');

    const row = await salaryRepository.queries.createBonus({
      userId,
      month,
      amount: String(amount),
      reason: String(input.reason || '').trim(),
      createdBy: actorId,
    });

    await notificationService.push({
      recipientIds: [userId],
      type: 'GENERIC',
      title: 'Bonus added',
      message: `A bonus for ${monthLabel(month)} has been added to your profile.`,
      link: `/staff/${userId}`,
      meta: { bonusRecordId: String(row._id) },
    });

    return toBonusDTO(row);
  }

  public async deleteBonus(id: string) {
    const existing = await salaryRepository.queries.findBonusById(id);
    if (!existing) throw new ValidationError('Bonus record not found.');
    await salaryRepository.queries.deleteBonusById(id);
    return true;
  }
}

export const salaryService = SalaryService.getInstance();
