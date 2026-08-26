import { BaseRepository } from '../../shared/repository/base-repository.js';
import { ExemptionModel, type IExemption, type ExemptionDocument } from './day-off.model.js';

/**
 * DayOffRepository – every DB read/write for admin-granted day-offs.
 * Queries are grouped in ONE object so reviewers can audit data access fast.
 */
export class DayOffRepository extends BaseRepository<IExemption> {
  private static instance: DayOffRepository | null = null;

  private constructor() {
    super(ExemptionModel);
  }

  public static getInstance(): DayOffRepository {
    if (!DayOffRepository.instance) {
      DayOffRepository.instance = new DayOffRepository();
    }
    return DayOffRepository.instance;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    /** Grant/upsert the day-off for (user, date); keeps reason fresh. */
    upsertByUserAndDate: (
      userId: string,
      date: string,
      reason: string,
      createdBy: string,
    ): Promise<ExemptionDocument> =>
      this.exec('upsertByUserAndDate', () =>
        ExemptionModel.findOneAndUpdate(
          { user: userId, date },
          { reason: reason || '', createdBy },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        ) as Promise<ExemptionDocument>,
      ),

    findById: (id: string): Promise<ExemptionDocument | null> =>
      this.exec('findById', () => this.qFindById(id) as Promise<ExemptionDocument | null>),

    findByIdPopulated: (id: string): Promise<ExemptionDocument | null> =>
      this.exec('findByIdPopulated', async () => {
        const doc = await this.qFindById(id);
        return doc ? ((await doc.populate(['user', 'createdBy'])) as ExemptionDocument) : null;
      }),

    deleteById: (id: string): Promise<ExemptionDocument | null> =>
      this.exec('deleteById', () => this.qDeleteById(id)),

    /** Day-off exemptions in a date range (admin view, newest first). */
    listByDateRange: (
      filters: { userId?: string; startDate?: string; endDate?: string } = {},
    ): Promise<ExemptionDocument[]> =>
      this.exec('listByDateRange', async () => {
        const filter: Record<string, unknown> = {};
        if (filters.userId) filter.user = filters.userId;
        if (filters.startDate || filters.endDate) {
          filter.date = {
            ...(filters.startDate ? { $gte: filters.startDate } : {}),
            ...(filters.endDate ? { $lte: filters.endDate } : {}),
          };
        }
        return ExemptionModel.find(filter)
          .populate('user')
          .populate('createdBy')
          .sort({ date: -1 })
          .limit(500);
      }),

    countByDate: (date: string): Promise<number> =>
      this.exec('countByDate', () => this.qCount({ date })),

    /** Lightweight date-only listing for trend charts. */
    listDatesInRange: (startDate: string, endDate: string): Promise<Pick<IExemption, 'date'>[]> =>
      this.exec('listDatesInRange', () =>
        ExemptionModel.find({ date: { $gte: startDate, $lte: endDate } })
          .select('date')
          .lean<{ _id: unknown; date: string }[]>(),
      ).then((docs) => docs as Pick<IExemption, 'date'>[]),

    findByUserAndDate: (userId: string, date: string): Promise<ExemptionDocument | null> =>
      this.exec('findByUserAndDate', () => this.qFindOne({ user: userId, date }) as Promise<ExemptionDocument | null>),
  };
}

export const dayOffRepository = DayOffRepository.getInstance();
