import { BaseRepository } from '../../shared/repository/base-repository.js';
import { HolidayModel, type IHoliday, type HolidayDocument } from './holiday.model.js';

/**
 * HolidayRepository – holiday calendar data access.
 */
export class HolidayRepository extends BaseRepository<IHoliday> {
  private static instance: HolidayRepository | null = null;

  private constructor() {
    super(HolidayModel);
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
      this.exec('listByYear', () => {
        const filter: Record<string, unknown> = { isActive: true };
        if (year) {
          filter.date = {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`),
          };
        }
        return HolidayModel.find(filter).sort({ date: 1 }) as Promise<HolidayDocument[]>;
      }),

    create: (data: Partial<IHoliday>): Promise<HolidayDocument> =>
      this.exec('create', async () => (await HolidayModel.create(data as IHoliday)) as HolidayDocument),

    deleteById: (id: string): Promise<HolidayDocument | null> =>
      this.exec('deleteById', () => this.qDeleteById(id)),
  };
}

export const holidayRepository = HolidayRepository.getInstance();
