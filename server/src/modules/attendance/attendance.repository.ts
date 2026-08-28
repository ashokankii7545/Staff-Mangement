import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { BaseRepository } from '../../shared/repository/base-repository.js';
import { populateRefs, populateRefsOne } from '../../shared/repository/populate.util.js';
import { attendance } from '../../db/schema/attendance.schema.js';
import type { IAttendance, AttendanceDocument } from './attendance.model.js';

export interface AttendanceRangeFilter {
  userId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

const REFS = { user: 'user', approvedBy: 'user', punchedOffice: 'office' } as const;

/**
 * AttendanceRepository – punch record data access (Postgres/Drizzle).
 * Multi-session model: many punches per user/day are allowed. `listByUserDate`
 * returns a day's punches time-ordered so the service can derive the current
 * open/closed state and pair sessions.
 */
export class AttendanceRepository extends BaseRepository<typeof attendance> {
  private static instance: AttendanceRepository | null = null;

  private constructor() {
    super(attendance);
  }

  public static getInstance(): AttendanceRepository {
    if (!AttendanceRepository.instance) {
      AttendanceRepository.instance = new AttendanceRepository();
    }
    return AttendanceRepository.instance;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    /**
     * Single-punch lookup. NOTE (multi-session): a day may hold multiple
     * punches of the same type, so this returns only ONE (arbitrary) match and
     * must NOT be used as a uniqueness guard. Prefer `listByUserDate` and pick
     * the specific punch you need. Retained for narrow single-row lookups/tests.
     */
    findByUserDateType: (
      userId: string,
      date: string,
      type: string,
    ): Promise<AttendanceDocument | null> =>
      this.exec('findByUserDateType', () =>
        this.qFindOne(
          and(eq(attendance.user, userId), eq(attendance.date, date), eq(attendance.type, type))!,
        ) as Promise<AttendanceDocument | null>,
      ),

    /**
     * All of a user's punches for a single day, oldest → newest. Drives the
     * multi-session state machine (last punch decides in/out) and session
     * pairing for total-hours math. Not populated (internal use).
     */
    listByUserDate: (userId: string, date: string): Promise<AttendanceDocument[]> =>
      this.exec('listByUserDate', async () => {
        const rows = await this.db
          .select()
          .from(attendance)
          .where(and(eq(attendance.user, userId), eq(attendance.date, date)))
          .orderBy(asc(attendance.createdAt));
        return this.withIds(rows) as unknown as AttendanceDocument[];
      }),

    create: (data: Partial<IAttendance>): Promise<AttendanceDocument> =>
      this.exec('create', () => this.qInsert(data) as Promise<AttendanceDocument>),

    findById: (id: string): Promise<AttendanceDocument | null> =>
      this.exec('findById', () => this.qFindById(id) as Promise<AttendanceDocument | null>),

    findByIdPopulated: (id: string): Promise<AttendanceDocument | null> =>
      this.exec('findByIdPopulated', async () => {
        const row = (await this.qFindById(id)) as AttendanceDocument | null;
        return populateRefsOne(row, { user: 'user' }) as Promise<AttendanceDocument | null>;
      }),

    /** Update an existing punch (flag review approval), returns populated. */
    updateById: (id: string, patch: Partial<IAttendance>): Promise<AttendanceDocument | null> =>
      this.exec('updateById', async () => {
        const row = (await this.qUpdateById(id, patch)) as AttendanceDocument | null;
        return populateRefsOne(row, { user: 'user' }) as Promise<AttendanceDocument | null>;
      }),

    /** Summary/history rows for a user or everyone, newest first (populated). */
    listByDateRange: (filters: AttendanceRangeFilter): Promise<AttendanceDocument[]> =>
      this.exec('listByDateRange', async () => {
        const conditions = [];
        if (filters.userId) conditions.push(eq(attendance.user, filters.userId));
        if (filters.startDate) conditions.push(gte(attendance.date, filters.startDate));
        if (filters.endDate) conditions.push(lte(attendance.date, filters.endDate));
        const base = this.db
          .select()
          .from(attendance)
          .orderBy(desc(attendance.date), desc(attendance.createdAt));
        const rows = conditions.length ? await base.where(and(...conditions)) : await base;
        return populateRefs(this.withIds(rows), REFS) as Promise<AttendanceDocument[]>;
      }),

    /** All CLOCK_IN punches of one day (dashboard / reminders), populated. */
    listClockInsByDate: (date: string): Promise<AttendanceDocument[]> =>
      this.exec('listClockInsByDate', async () => {
        const rows = await this.db
          .select()
          .from(attendance)
          .where(and(eq(attendance.date, date), eq(attendance.type, 'CLOCK_IN')));
        return populateRefs(this.withIds(rows), REFS) as Promise<AttendanceDocument[]>;
      }),

    listClockInsByDateSelectUser: (date: string): Promise<AttendanceDocument[]> =>
      this.exec('listClockInsByDateSelectUser', async () => {
        const rows = await this.db
          .select({ id: attendance.id, user: attendance.user })
          .from(attendance)
          .where(and(eq(attendance.date, date), eq(attendance.type, 'CLOCK_IN')));
        return this.withIds(rows) as unknown as AttendanceDocument[];
      }),

    listClockOutsByDateSelectUser: (date: string): Promise<AttendanceDocument[]> =>
      this.exec('listClockOutsByDateSelectUser', async () => {
        const rows = await this.db
          .select({ id: attendance.id, user: attendance.user })
          .from(attendance)
          .where(and(eq(attendance.date, date), eq(attendance.type, 'CLOCK_OUT')));
        return this.withIds(rows) as unknown as AttendanceDocument[];
      }),

    /** Monthly trend – CLOCK_IN punches across a date window (populated). */
    listClockInsBetween: (startDate: string, endDate: string): Promise<AttendanceDocument[]> =>
      this.exec('listClockInsBetween', async () => {
        const rows = await this.db
          .select()
          .from(attendance)
          .where(
            and(
              gte(attendance.date, startDate),
              lte(attendance.date, endDate),
              eq(attendance.type, 'CLOCK_IN'),
            ),
          );
        return populateRefs(this.withIds(rows), REFS) as Promise<AttendanceDocument[]>;
      }),

    /**
     * Admin feed of latest punches across everyone or one staff member.
     * `filter` is either {} (all) or { user: <id> } to match prior callers.
     */
    recentActivity: (
      filter: Record<string, unknown>,
      limit = 10,
    ): Promise<AttendanceDocument[]> =>
      this.exec('recentActivity', async () => {
        const userId = filter.user ? String(filter.user) : null;
        const base = this.db
          .select()
          .from(attendance)
          .orderBy(desc(attendance.createdAt))
          .limit(limit);
        const rows = userId ? await base.where(eq(attendance.user, userId)) : await base;
        return populateRefs(this.withIds(rows), REFS) as Promise<AttendanceDocument[]>;
      }),
  };
}

export const attendanceRepository = AttendanceRepository.getInstance();
