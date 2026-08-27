import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { BaseRepository } from '../../shared/repository/base-repository.js';
import { populateRefs, populateRefsOne } from '../../shared/repository/populate.util.js';
import { leaveRequests } from '../../db/schema/leave.schema.js';
import type { ILeaveRequest, LeaveRequestDocument } from './leave.model.js';

const REFS = { user: 'user', approvedBy: 'user' } as const;

/**
 * LeaveRepository – leave request data-access catalog (Postgres/Drizzle).
 * user/approvedBy are populated with user objects to match prior behavior.
 */
export class LeaveRepository extends BaseRepository<typeof leaveRequests> {
  private static instance: LeaveRepository | null = null;

  private constructor() {
    super(leaveRequests);
  }

  public static getInstance(): LeaveRepository {
    if (!LeaveRepository.instance) {
      LeaveRepository.instance = new LeaveRepository();
    }
    return LeaveRepository.instance;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    listMine: (userId: string): Promise<LeaveRequestDocument[]> =>
      this.exec('listMine', async () => {
        const rows = await this.db
          .select()
          .from(leaveRequests)
          .where(eq(leaveRequests.user, userId))
          .orderBy(desc(leaveRequests.createdAt));
        return populateRefs(this.withIds(rows), REFS) as Promise<LeaveRequestDocument[]>;
      }),

    listAll: (status?: string): Promise<LeaveRequestDocument[]> =>
      this.exec('listAll', async () => {
        const base = this.db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt));
        const rows = status ? await base.where(eq(leaveRequests.status, status)) : await base;
        return populateRefs(this.withIds(rows), REFS) as Promise<LeaveRequestDocument[]>;
      }),

    countPending: (): Promise<number> =>
      this.exec('countPending', () => this.qCount(eq(leaveRequests.status, 'PENDING'))),

    /** Overlap guard – PENDING/APPROVED leaves block double-booking. */
    findOverlapping: (
      userId: string,
      startDate: string | Date,
      endDate: string | Date,
    ): Promise<LeaveRequestDocument | null> =>
      this.exec('findOverlapping', () =>
        this.qFindOne(
          and(
            eq(leaveRequests.user, userId),
            inArray(leaveRequests.status, ['PENDING', 'APPROVED']),
            lte(leaveRequests.startDate, new Date(endDate)),
            gte(leaveRequests.endDate, new Date(startDate)),
          )!,
        ) as Promise<LeaveRequestDocument | null>,
      ),

    findById: (id: string): Promise<LeaveRequestDocument | null> =>
      this.exec('findById', () => this.qFindById(id) as Promise<LeaveRequestDocument | null>),

    findByIdPopulatedUser: (id: string): Promise<LeaveRequestDocument | null> =>
      this.exec('findByIdPopulatedUser', async () => {
        const row = (await this.qFindById(id)) as LeaveRequestDocument | null;
        return populateRefsOne(row, { user: 'user' }) as Promise<LeaveRequestDocument | null>;
      }),

    create: (data: Partial<ILeaveRequest>): Promise<LeaveRequestDocument> =>
      this.exec('create', () => this.qInsert(data) as Promise<LeaveRequestDocument>),

    /** Count APPROVED leaves that cover a given day (dashboard "on leave" tile). */
    countApprovedOnDate: (day: string | Date): Promise<number> =>
      this.exec('countApprovedOnDate', () =>
        this.qCount(
          and(
            eq(leaveRequests.status, 'APPROVED'),
            lte(leaveRequests.startDate, new Date(day)),
            gte(leaveRequests.endDate, new Date(day)),
          )!,
        ),
      ),

    /** Update status/feedback/approver, returning the populated row. */
    updateById: (id: string, patch: Partial<ILeaveRequest>): Promise<LeaveRequestDocument | null> =>
      this.exec('updateById', async () => {
        const row = (await this.qUpdateById(id, patch)) as LeaveRequestDocument | null;
        return populateRefsOne(row, REFS) as Promise<LeaveRequestDocument | null>;
      }),
  };
}

export const leaveRepository = LeaveRepository.getInstance();
