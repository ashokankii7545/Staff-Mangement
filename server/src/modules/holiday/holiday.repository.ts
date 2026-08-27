import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { BaseRepository } from '../../shared/repository/base-repository.js';
import { holidays } from '../../db/schema/holiday.schema.js';
import type { IHoliday, HolidayDocument } from './holiday.model.js';

/**
 * HolidayRepository – holiday calendar data access (Postgres/Drizzle).
 */
export class HolidayRepository extends BaseRepository<typeof holidays> {
  private static instance: HolidayRepository | null = null;

  private constructor() {
    super(holidays);
  }

  public static getInstance(): HolidayRepository {
    if (!HolidayRepository.instance) {
      HolidayRepository.instance = new HolidayRepository();
    }
    return HolidayRepository.instance;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    /** Active holidays, optionally constrained to a calendar year. */
    listByYear: (year?: number): Promise<HolidayDocument[]> =>
      this.exec('listByYear', async () => {
        const conditions = [eq(holidays.isActive, true)];
        if (year) {
          conditions.push(gte(holidays.date, new Date(`${year}-01-01`)));
          conditions.push(lte(holidays.date, new Date(`${year}-12-31T23:59:59.999Z`)));
        }
        const rows = await this.db
          .select()
          .from(holidays)
          .where(and(...conditions))
          .orderBy(asc(holidays.date));
        return this.withIds(rows) as HolidayDocument[];
      }),

    create: (data: Partial<IHoliday>): Promise<HolidayDocument> =>
      this.exec('create', () => this.qInsert(data) as Promise<HolidayDocument>),

    deleteById: (id: string): Promise<HolidayDocument | null> =>
      this.exec('deleteById', () => this.qDeleteById(id) as Promise<HolidayDocument | null>),
  };
}

export const holidayRepository = HolidayRepository.getInstance();
