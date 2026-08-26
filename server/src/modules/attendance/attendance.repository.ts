import type { FilterQuery, SortOrder } from 'mongoose';
import { BaseRepository } from '../../shared/repository/base-repository.js';
import { AttendanceModel, type IAttendance, type AttendanceDocument } from './attendance.model.js';

export interface AttendanceRangeFilter {
  userId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

/**
 * AttendanceRepository – punch records ke saare DB operations yahan.
 * Har query ka naam + intent clear hai; execution shared executor se hoti hai.
 */
export class AttendanceRepository extends BaseRepository<IAttendance> {
  private static instance: AttendanceRepository | null = null;

  private constructor() {
    super(AttendanceModel);
  }

  public static getInstance(): AttendanceRepository {
    if (!AttendanceRepository.instance) {
      AttendanceRepository.instance = new AttendanceRepository();
    }
    return AttendanceRepository.instance;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    /** Duplicate-punch guard + clock-out precondition check. */
    findByUserDateType: (
      userId: string,
      date: string,
      type: string,
    ): Promise<AttendanceDocument | null> =>
      this.exec('findByUserDateType', () =>
        this.qFindOne({ user: userId, date, type }) as Promise<AttendanceDocument | null>,
      ),

    create: (data: Partial<IAttendance>): Promise<AttendanceDocument> =>
      this.exec('create', async () => (await AttendanceModel.create(data as IAttendance)) as AttendanceDocument),

    findById: (id: string): Promise<AttendanceDocument | null> =>
      this.exec('findById', () => this.qFindById(id) as Promise<AttendanceDocument | null>),

    findByIdPopulated: (id: string): Promise<AttendanceDocument | null> =>
      this.exec('findByIdPopulated', async () => {
        const doc = await this.qFindById(id);
        return doc ? ((await doc.populate('user')) as AttendanceDocument) : null;
      }),

    /** Summary/history rows for a user or everyone, newest first. */
    listByDateRange: (
      filters: AttendanceRangeFilter,
      sort: Record<string, SortOrder> = { date: -1, createdAt: -1 },
    ): Promise<AttendanceDocument[]> =>
      this.exec('listByDateRange', async () => {
        const filter: FilterQuery<IAttendance> = {};
        if (filters.userId) filter.user = filters.userId;
        if (filters.startDate || filters.endDate) {
          filter.date = {
            ...(filters.startDate ? { $gte: filters.startDate } : {}),
            ...(filters.endDate ? { $lte: filters.endDate } : {}),
          };
        }
        return AttendanceModel.find(filter).populate('user').sort(sort) as Promise<AttendanceDocument[]>;
      }),

    /** All CLOCK_IN punches of one day (dashboard / reminders). */
    listClockInsByDate: (date: string): Promise<AttendanceDocument[]> =>
      this.exec('listClockInsByDate', () =>
        AttendanceModel.find({ date, type: 'CLOCK_IN' }).populate('user') as Promise<AttendanceDocument[]>,
      ),

    listClockInsByDateSelectUser: (date: string): Promise<AttendanceDocument[]> =>
      this.exec('listClockInsByDateSelectUser', () =>
        AttendanceModel.find({ date, type: 'CLOCK_IN' }).select('user') as Promise<AttendanceDocument[]>,
      ),

    listClockOutsByDateSelectUser: (date: string): Promise<AttendanceDocument[]> =>
      this.exec('listClockOutsByDateSelectUser', () =>
        AttendanceModel.find({ date, type: 'CLOCK_OUT' }).select('user') as Promise<AttendanceDocument[]>,
      ),

    /** Monthly trend – CLOCK_IN punches across a date window. */
    listClockInsBetween: (startDate: string, endDate: string): Promise<AttendanceDocument[]> =>
      this.exec('listClockInsBetween', () =>
        AttendanceModel.find({
          date: { $gte: startDate, $lte: endDate },
          type: 'CLOCK_IN',
        }).populate('user') as Promise<AttendanceDocument[]>,
      ),

    recentActivity: (filter: FilterQuery<IAttendance>, limit = 10): Promise<AttendanceDocument[]> =>
      this.exec('recentActivity', () =>
        AttendanceModel.find(filter)
          .populate('user')
          .sort({ createdAt: -1 })
          .limit(limit) as Promise<AttendanceDocument[]>,
      ),

    /** Regularization approval – upsert-style clock record for a past day. */
    findOrCreatePunch: async (
      userId: string,
      date: string,
      type: string,
      build: () => Partial<IAttendance>,
    ): Promise<AttendanceDocument> => {
      const existing = await this.queries.findByUserDateType(userId, date, type);
      if (existing) return existing;
      return this.queries.create({ ...build(), user: userId as unknown as IAttendance['user'], date, type: type as IAttendance['type'] });
    },
  };
}

export const attendanceRepository = AttendanceRepository.getInstance();
