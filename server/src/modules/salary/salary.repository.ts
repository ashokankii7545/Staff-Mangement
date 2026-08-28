import { asc, desc, eq } from 'drizzle-orm';
import { BaseRepository } from '../../shared/repository/base-repository.js';
import { salaryRecords, bonusRecords } from '../../db/schema/salary.schema.js';
import type { SalaryRecordDoc, BonusRecordDoc } from './salary.model.js';
import type { ISalaryRecord, IBonusRecord } from './salary.model.js';

/**
 * SalaryRepository - payroll + bonus records data access (Postgres/Drizzle).
 * Salary and bonus live in two tables but share one repository because the
 * profile screen always loads them together. Extends the shared BaseRepository
 * (single-table executor) and reaches the second table through this.db.
 */
export class SalaryRepository extends BaseRepository<typeof salaryRecords> {
  private static instance: SalaryRepository | null = null;

  private constructor() {
    super(salaryRecords);
  }

  public static getInstance(): SalaryRepository {
    if (!SalaryRepository.instance) {
      SalaryRepository.instance = new SalaryRepository();
    }
    return SalaryRepository.instance;
  }

  /** Query catalog - services NEVER touch Drizzle directly. */
  public readonly queries = {
    listSalaryByUser: (userId: string): Promise<SalaryRecordDoc[]> =>
      this.exec('listSalaryByUser', async () => {
        const rows = await this.db
          .select()
          .from(salaryRecords)
          .where(eq(salaryRecords.userId, userId))
          .orderBy(desc(salaryRecords.month));
        return this.withIds(rows) as SalaryRecordDoc[];
      }),

    listBonusByUser: (userId: string): Promise<BonusRecordDoc[]> =>
      this.exec('listBonusByUser', async () => {
        const rows = await this.db
          .select()
          .from(bonusRecords)
          .where(eq(bonusRecords.userId, userId))
          .orderBy(desc(bonusRecords.month), asc(bonusRecords.createdAt));
        return this.withIds(rows) as BonusRecordDoc[];
      }),

    createSalary: (data: Partial<ISalaryRecord>): Promise<SalaryRecordDoc> =>
      this.exec('createSalary', async () => {
        const rows = await this.db.insert(salaryRecords).values(data as never).returning();
        return this.withIds(rows)[0] as SalaryRecordDoc;
      }),

    createBonus: (data: Partial<IBonusRecord>): Promise<BonusRecordDoc> =>
      this.exec('createBonus', async () => {
        const rows = await this.db.insert(bonusRecords).values(data as never).returning();
        return this.withIds(rows)[0] as BonusRecordDoc;
      }),

    findSalaryById: (id: string): Promise<SalaryRecordDoc | null> =>
      this.exec('findSalaryById', async () => {
        const rows = await this.db.select().from(salaryRecords).where(eq(salaryRecords.id, id)).limit(1);
        return (this.withIds(rows)[0] as SalaryRecordDoc) ?? null;
      }),

    findBonusById: (id: string): Promise<BonusRecordDoc | null> =>
      this.exec('findBonusById', async () => {
        const rows = await this.db.select().from(bonusRecords).where(eq(bonusRecords.id, id)).limit(1);
        return (this.withIds(rows)[0] as BonusRecordDoc) ?? null;
      }),

    deleteSalaryById: (id: string): Promise<SalaryRecordDoc | null> =>
      this.exec('deleteSalaryById', async () => {
        const rows = await this.db.delete(salaryRecords).where(eq(salaryRecords.id, id)).returning();
        return (this.withIds(rows)[0] as SalaryRecordDoc) ?? null;
      }),

    deleteBonusById: (id: string): Promise<BonusRecordDoc | null> =>
      this.exec('deleteBonusById', async () => {
        const rows = await this.db.delete(bonusRecords).where(eq(bonusRecords.id, id)).returning();
        return (this.withIds(rows)[0] as BonusRecordDoc) ?? null;
      }),
  };
}

export const salaryRepository = SalaryRepository.getInstance();
