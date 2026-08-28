import { and, asc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { BaseRepository } from '../../shared/repository/base-repository.js';
import { users } from '../../db/schema/user.schema.js';
import { hashPassword } from '../../shared/utils/password.util.js';
import type { IUser, IUserDocument } from './user.model.js';

/** Options accepted by catalog entries that can populate refs. */
export interface FindUserOptions {
  populate?: Array<'assignedOffice' | 'temporaryAssignment.office'>;
}

/**
 * UserRepository – ALL database access for the user module lives here
 * (Postgres/Drizzle). The public `queries` catalog keeps the SAME signatures
 * as the Mongoose version so services/resolvers/auth are unchanged.
 *
 * Notes on parity with the old behavior:
 *  - Password hashing (was a Mongoose pre-save hook) now happens here on
 *    create/update whenever a `password` field is present.
 *  - `assignedOffice` / `temporaryAssignment.office` are returned as uuid
 *    strings; the resolver/DataLoader "populates" them, exactly as before.
 *  - Atomic leave-balance ops use jsonb arithmetic in a single UPDATE so two
 *    concurrent approvals can never both pass the >= guard.
 */
export class UserRepository extends BaseRepository<typeof users> {
  private static instance: UserRepository | null = null;

  private constructor() {
    super(users);
  }

  public static getInstance(): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository();
    }
    return UserRepository.instance;
  }

  /** Hash the password field in-place when present (create/update parity with pre-save hook). */
  private async withHashedPassword<T extends { password?: string | null }>(data: T): Promise<T> {
    if (data.password) {
      return { ...data, password: await hashPassword(String(data.password)) };
    }
    return data;
  }

  /**
   * Normalize array-typed columns so the postgres.js driver never receives a
   * non-array (e.g. a client sending `restrictedPages: {}` instead of `[]`,
   * which would throw "value.map is not a function"). Applied before writes.
   */
  private normalizeArrays(data: Record<string, unknown>): Record<string, unknown> {
    const out = { ...data };
    for (const key of ['restrictedPages', 'faceEmbedding'] as const) {
      if (key in out && !Array.isArray(out[key])) {
        // Treat null/undefined/empty-object as an empty array; keep nothing else.
        out[key] = [];
      }
    }
    return out;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    findById: (id: string, _options: FindUserOptions = {}): Promise<IUserDocument | null> =>
      // Population is handled by the resolver/DataLoader; the row carries ids.
      this.exec('findById', () => this.qFindById(id) as Promise<IUserDocument | null>),

    findByIdentifier: (identifier: string): Promise<IUserDocument | null> =>
      this.exec('findByIdentifier', () =>
        this.qFindOne(
          or(eq(users.email, identifier.toLowerCase()), eq(users.employeeId, identifier))!,
        ) as Promise<IUserDocument | null>,
      ),

    findByEmail: (email: string): Promise<IUserDocument | null> =>
      this.exec('findByEmail', () =>
        this.qFindOne(eq(users.email, email.toLowerCase())) as Promise<IUserDocument | null>,
      ),

    findByEmployeeId: (employeeId: string): Promise<IUserDocument | null> =>
      this.exec('findByEmployeeId', () =>
        this.qFindOne(
          eq(users.employeeId, String(employeeId).trim().toUpperCase()),
        ) as Promise<IUserDocument | null>,
      ),

    findByGoogleIdOrEmail: (googleId: string, email: string): Promise<IUserDocument | null> =>
      this.exec('findByGoogleIdOrEmail', () =>
        this.qFindOne(
          or(eq(users.googleId, googleId), eq(users.email, email.toLowerCase()))!,
        ) as Promise<IUserDocument | null>,
      ),

    /** Password-reset: match a non-expired reset token. */
    findByValidResetToken: (token: string): Promise<IUserDocument | null> =>
      this.exec('findByValidResetToken', () =>
        this.qFindOne(
          and(
            eq(users.resetPasswordToken, token),
            sql`${users.resetPasswordExpires} > now()`,
          )!,
        ) as Promise<IUserDocument | null>,
      ),

    existsByEmployeeId: (employeeId: string): Promise<boolean> =>
      this.exec('existsByEmployeeId', () => this.qExists(eq(users.employeeId, employeeId))),

    existsByEmail: (email: string): Promise<boolean> =>
      this.exec('existsByEmail', () => this.qExists(eq(users.email, email.toLowerCase()))),

    /** Active, fully-approved staff accounts (reminder sweeps). */
    listActiveStaff: (): Promise<IUserDocument[]> =>
      this.exec('listActiveStaff', () =>
        this.qFindMany(
          and(eq(users.role, 'STAFF'), eq(users.isActive, true), eq(users.approvalStatus, 'APPROVED'))!,
        ) as Promise<IUserDocument[]>,
      ),

    findActiveAdmins: (): Promise<IUserDocument[]> =>
      this.exec('findActiveAdmins', () =>
        this.qFindMany(and(eq(users.role, 'ADMIN'), eq(users.isActive, true))!) as Promise<IUserDocument[]>,
      ),

    findActiveAdminEmails: (): Promise<string[]> =>
      this.exec('findActiveAdminEmails', async () => {
        const rows = await this.db
          .select({ email: users.email })
          .from(users)
          .where(and(eq(users.role, 'ADMIN'), eq(users.isActive, true)));
        return rows.map((r) => r.email).filter(Boolean);
      }),

    findActiveStaffEmails: (): Promise<string[]> =>
      this.exec('findActiveStaffEmails', async () => {
        const rows = await this.db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.isActive, true));
        return rows.map((r) => r.email).filter(Boolean);
      }),

    countActiveStaff: (): Promise<number> =>
      this.exec('countActiveStaff', () =>
        this.qCount(and(eq(users.role, 'STAFF'), eq(users.isActive, true))!),
      ),

    create: (data: Partial<IUser>): Promise<IUserDocument> =>
      this.exec('create', async () => {
        const values = this.normalizeArrays(await this.withHashedPassword(data));
        return this.qInsert(values) as Promise<IUserDocument>;
      }),

    deleteById: (id: string): Promise<IUserDocument | null> =>
      this.exec('deleteById', () => this.qDeleteById(id) as Promise<IUserDocument | null>),

    /** Generic partial update (profile edits, approval flows…). */
    updateById: (
      id: string,
      update: Record<string, unknown>,
      _options: FindUserOptions = {},
    ): Promise<IUserDocument | null> =>
      this.exec('updateById', async () => {
        const values = this.normalizeArrays(await this.withHashedPassword(update as { password?: string | null }));
        return this.qUpdateById(id, values) as Promise<IUserDocument | null>;
      }),

    /** Admin directory listing, optionally filtered by active state. */
    listUsers: (filters: { isActive?: boolean } = {}): Promise<IUserDocument[]> =>
      this.exec('listUsers', async () => {
        const where = filters.isActive !== undefined ? eq(users.isActive, filters.isActive) : undefined;
        const base = this.db.select().from(users).orderBy(asc(users.name));
        const rows = where ? await base.where(where) : await base;
        return this.withIds(rows) as IUserDocument[];
      }),

    listUsersPaginated: (
      pagination: { page?: number; limit?: number; search?: string } = {},
      isActive?: boolean,
    ) =>
      this.exec('listUsersPaginated', async () => {
        const page = Math.max(1, pagination.page || 1);
        const limit = Math.max(1, pagination.limit || 10);
        const offset = (page - 1) * limit;

        const conditions = [];
        if (isActive !== undefined) conditions.push(eq(users.isActive, isActive));
        if (pagination.search) {
          const term = `%${pagination.search}%`;
          conditions.push(
            or(ilike(users.name, term), ilike(users.email, term), ilike(users.employeeId, term))!,
          );
        }
        const where = conditions.length ? and(...conditions) : undefined;

        const countBase = this.db.select({ count: sql<number>`count(*)::int` }).from(users);
        const dataBase = this.db.select().from(users).orderBy(asc(users.name)).limit(limit).offset(offset);

        const [countRows, data] = await Promise.all([
          where ? countBase.where(where) : countBase,
          where ? dataBase.where(where) : dataBase,
        ]);

        const totalCount = countRows[0]?.count ?? 0;
        const totalPages = Math.ceil(totalCount / limit);

        return {
          data: this.withIds(data) as IUserDocument[],
          pageInfo: {
            totalCount,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
          },
        };
      }),

    /** Self-signups waiting for an admin decision. */
    listPendingSignups: (): Promise<IUserDocument[]> =>
      this.exec('listPendingSignups', async () => {
        const rows = await this.db
          .select()
          .from(users)
          .where(and(eq(users.approvalStatus, 'PENDING'), eq(users.role, 'STAFF')))
          .orderBy(asc(users.createdAt));
        return this.withIds(rows) as IUserDocument[];
      }),

    /** Store the SFace 128-d enrollment embedding (pgvector) for a user. */
    setFaceVector: (userId: string, embedding: number[]): Promise<void> =>
      this.exec('setFaceVector', async () => {
        await this.db.update(users).set({ faceVector: embedding, updatedAt: new Date() }).where(eq(users.id, userId));
      }),

    /** Fetch just a user's enrolled face embedding (null when not enrolled). */
    getFaceVector: (userId: string): Promise<number[] | null> =>
      this.exec('getFaceVector', async () => {
        const rows = await this.db
          .select({ faceVector: users.faceVector })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        return rows[0]?.faceVector ?? null;
      }),

    /** Persist the UI theme so it follows the user across devices. */
    setThemePreference: (userId: string, mode: string): Promise<IUserDocument | null> =>
      this.exec('setThemePreference', () =>
        this.qUpdateById(userId, { themePreference: mode }) as Promise<IUserDocument | null>,
      ),

    /** Leave bookkeeping – write an exact floored balance for one leave type. */
    setLeaveBalance: (userId: string, typeKey: string, value: number): Promise<IUserDocument | null> =>
      this.exec('setLeaveBalance', async () => {
        const floored = Math.max(0, Math.floor(value));
        const rows = await this.db
          .update(users)
          .set({
            leaveBalances: sql`jsonb_set(${users.leaveBalances}, ${`{${typeKey}}`}, ${sql.raw(String(floored))}::text::jsonb, true)`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))
          .returning();
        return this.withId(rows[0] ?? null) as IUserDocument | null;
      }),

    /**
     * ⚡ ATOMIC guard-decrement (race-proof):
     * Succeeds ONLY if the stored balance is still >= days at the moment of the
     * update. Two concurrent approvals can never both pass this.
     */
    deductLeaveBalanceIfAvailable: (userId: string, typeKey: string, days: number): Promise<boolean> =>
      this.exec('deductLeaveBalanceIfAvailable', async () => {
        const rows = await this.db
          .update(users)
          .set({
            leaveBalances: sql`jsonb_set(${users.leaveBalances}, ${`{${typeKey}}`}, ((${users.leaveBalances} ->> ${typeKey})::numeric - ${days})::text::jsonb, true)`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(users.id, userId),
              sql`(${users.leaveBalances} ->> ${typeKey})::numeric >= ${days}`,
            ),
          )
          .returning({ id: users.id });
        return rows.length > 0;
      }),

    /** ⚡ ATOMIC increment/refund (no read-modify-write window). */
    addLeaveBalance: (userId: string, typeKey: string, days: number): Promise<unknown> =>
      this.exec('addLeaveBalance', () =>
        this.db
          .update(users)
          .set({
            leaveBalances: sql`jsonb_set(${users.leaveBalances}, ${`{${typeKey}}`}, ((${users.leaveBalances} ->> ${typeKey})::numeric + ${days})::text::jsonb, true)`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId)),
      ),

    /**
     * Accrual engine – interprets the same op shapes the leave service builds:
     *   { updateMany: { filter: { isActive: true },
     *                   update: { $inc | $set: { 'leaveBalances.<key>': n } } } }
     * Each op maps to one bulk jsonb UPDATE across all active users.
     */
    bulkWrite: (ops: Array<Record<string, unknown>>): Promise<unknown> =>
      this.exec('bulkWrite', async () => {
        for (const op of ops) {
          const updateMany = (op as { updateMany?: { filter?: Record<string, unknown>; update?: Record<string, unknown> } }).updateMany;
          if (!updateMany?.update) continue;

          const activeOnly = updateMany.filter?.isActive === true;
          const whereClause = activeOnly ? eq(users.isActive, true) : undefined;

          const inc = (updateMany.update.$inc ?? {}) as Record<string, number>;
          const set = (updateMany.update.$set ?? {}) as Record<string, number>;

          for (const [path, n] of Object.entries(inc)) {
            const key = path.replace('leaveBalances.', '');
            const q = this.db.update(users).set({
              leaveBalances: sql`jsonb_set(${users.leaveBalances}, ${`{${key}}`}, ((${users.leaveBalances} ->> ${key})::numeric + ${n})::text::jsonb, true)`,
              updatedAt: new Date(),
            });
            // eslint-disable-next-line no-await-in-loop
            await (whereClause ? q.where(whereClause) : q);
          }
          for (const [path, n] of Object.entries(set)) {
            const key = path.replace('leaveBalances.', '');
            const q = this.db.update(users).set({
              leaveBalances: sql`jsonb_set(${users.leaveBalances}, ${`{${key}}`}, ${sql.raw(String(Math.floor(n)))}::text::jsonb, true)`,
              updatedAt: new Date(),
            });
            // eslint-disable-next-line no-await-in-loop
            await (whereClause ? q.where(whereClause) : q);
          }
        }
        return { ok: true };
      }),
  };
}

export const userRepository = UserRepository.getInstance();
