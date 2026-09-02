import { and, asc, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { BaseRepository } from '../../shared/repository/base-repository.js';
import { populateRefs, populateRefsOne } from '../../shared/repository/populate.util.js';
import { attendance, type AttendanceRow } from '../../db/schema/attendance.schema.js';
import { users } from '../../db/schema/user.schema.js';
import { offices } from '../../db/schema/office.schema.js';
import type { IAttendance, AttendanceDocument } from './attendance.model.js';

export interface AttendanceRangeFilter {
  userId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

const REFS = { user: 'user', approvedBy: 'user', punchedOffice: 'office' } as const;

/** Aliased table copies so ONE query can join owner + approver + office. */
const ownerUser = alias(users, 'punch_owner');
const approverUser = alias(users, 'punch_approver');

interface JoinedAttendanceRow {
  punch: AttendanceRow;
  owner: typeof users.$inferSelect | null;
  approver: typeof users.$inferSelect | null;
  office: typeof offices.$inferSelect | null;
}

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

  /**
   * Map a JOINed row back into the old "populated" document shape:
   * uuid refs become full objects carrying `_id`, exactly like populateRefs.
   */
  private toPopulated(row: JoinedAttendanceRow): AttendanceDocument {
    const { punch, owner, approver, office } = row;
    const out: Record<string, unknown> = { ...punch, _id: String(punch.id) };
    if (owner) out.user = { ...owner, _id: String(owner.id) };
    else if (punch.user) out.user = String(punch.user);
    if (approver) out.approvedBy = { ...approver, _id: String(approver.id) };
    else if (punch.approvedBy) out.approvedBy = String(punch.approvedBy);
    if (office) out.punchedOffice = { ...office, _id: String(office.id) };
    else if (punch.punchedOffice) out.punchedOffice = String(punch.punchedOffice);
    return out as AttendanceDocument;
  }

  /**
   * Base SELECT that hydrates user / approvedBy / punchedOffice in ONE database
   * round-trip via LEFT JOINs instead of a separate `populateRefs` query
   * (which cost a second ~200ms round-trip on the remote cluster).
   */
  private joinedBase() {
    return this.db
      .select({
        punch: attendance,
        owner: ownerUser,
        approver: approverUser,
        office: offices,
      })
      .from(attendance)
      .leftJoin(ownerUser, eq(attendance.user, ownerUser.id))
      .leftJoin(approverUser, eq(attendance.approvedBy, approverUser.id))
      .leftJoin(offices, eq(attendance.punchedOffice, offices.id));
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
        const conditions: SQL[] = [];
        if (filters.userId) conditions.push(eq(attendance.user, filters.userId));
        if (filters.startDate) conditions.push(gte(attendance.date, filters.startDate));
        if (filters.endDate) conditions.push(lte(attendance.date, filters.endDate));
        const base = this.joinedBase().orderBy(desc(attendance.date), desc(attendance.createdAt));
        const rows = conditions.length ? await base.where(and(...conditions)!) : await base;
        return rows.map((r) => this.toPopulated(r));
      }),

    /** All CLOCK_IN punches of one day (dashboard / reminders), populated. */
    listClockInsByDate: (date: string): Promise<AttendanceDocument[]> =>
      this.exec('listClockInsByDate', async () => {
        const rows = await this.joinedBase()
          .where(and(eq(attendance.date, date), eq(attendance.type, 'CLOCK_IN'))!)
          .orderBy(asc(attendance.createdAt));
        return rows.map((r) => this.toPopulated(r));
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
        const rows = await this.joinedBase()
          .where(
            and(
              gte(attendance.date, startDate),
              lte(attendance.date, endDate),
              eq(attendance.type, 'CLOCK_IN'),
            )!,
          )
          .orderBy(asc(attendance.date), asc(attendance.createdAt));
        return rows.map((r) => this.toPopulated(r));
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
        const base = this.joinedBase()
          .orderBy(desc(attendance.createdAt))
          .limit(limit);
        const rows = userId ? await base.where(eq(attendance.user, userId)) : await base;
        return rows.map((r) => this.toPopulated(r));
      }),
  };
}

export const attendanceRepository = AttendanceRepository.getInstance();
