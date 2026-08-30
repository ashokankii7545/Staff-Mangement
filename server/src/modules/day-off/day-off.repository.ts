import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { BaseRepository } from '../../shared/repository/base-repository.js';
import { exemptions } from '../../db/schema/day-off.schema.js';
import { users } from '../../db/schema/user.schema.js';
import type { IExemption, ExemptionDocument } from './day-off.model.js';

/**
 * DayOffRepository – every DB read/write for admin-granted day-offs
 * (Postgres/Drizzle). Populated variants attach user/createdBy objects.
 */
export class DayOffRepository extends BaseRepository<typeof exemptions> {
  private static instance: DayOffRepository | null = null;

  private constructor() {
    super(exemptions);
  }

  public static getInstance(): DayOffRepository {
    if (!DayOffRepository.instance) {
      DayOffRepository.instance = new DayOffRepository();
    }
    return DayOffRepository.instance;
  }

  /** Attach populated user/createdBy objects (with _id) to an exemption row. */
  private async populate(row: ExemptionDocument | null): Promise<ExemptionDocument | null> {
    if (!row) return null;
    const [populated] = await this.populateMany([row]);
    return populated ?? null;
  }

  private async populateMany(rows: ExemptionDocument[]): Promise<ExemptionDocument[]> {
    const ids = new Set<string>();
    for (const r of rows) {
      if (r.user) ids.add(String(r.user));
      if (r.createdBy) ids.add(String(r.createdBy));
    }
    if (ids.size === 0) return rows;
    // Only hydrate the users actually referenced by these rows. Previously this
    // did `select().from(users)` (the ENTIRE users table) on every attendance
    // summary screen – an unbounded read that grew with headcount.
    const found = await this.db
      .select()
      .from(users)
      .where(inArray(users.id, [...ids]));
    const map = new Map(found.map((u) => [String(u.id), { ...u, _id: String(u.id) }]));
    return rows.map((r) => ({
      ...r,
      user: r.user ? map.get(String(r.user)) ?? r.user : r.user,
      createdBy: r.createdBy ? map.get(String(r.createdBy)) ?? r.createdBy : r.createdBy,
    })) as unknown as ExemptionDocument[];
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    /** Grant/upsert the day-off for (user, date); keeps reason fresh. Returns populated. */
    upsertByUserAndDate: (
      userId: string,
      date: string,
      reason: string,
      createdBy: string,
    ): Promise<ExemptionDocument> =>
      this.exec('upsertByUserAndDate', async () => {
        const rows = await this.db
          .insert(exemptions)
          .values({ user: userId, date, reason: reason || '', createdBy })
          .onConflictDoUpdate({
            target: [exemptions.user, exemptions.date],
            set: { reason: reason || '', createdBy, updatedAt: new Date() },
          })
          .returning();
        const populated = await this.populate(this.withId(rows[0]) as ExemptionDocument);
        return populated as ExemptionDocument;
      }),

    findById: (id: string): Promise<ExemptionDocument | null> =>
      this.exec('findById', () => this.qFindById(id) as Promise<ExemptionDocument | null>),

    findByIdPopulated: (id: string): Promise<ExemptionDocument | null> =>
      this.exec('findByIdPopulated', async () => {
        const row = (await this.qFindById(id)) as ExemptionDocument | null;
        return this.populate(row);
      }),

    deleteById: (id: string): Promise<ExemptionDocument | null> =>
      this.exec('deleteById', () => this.qDeleteById(id) as Promise<ExemptionDocument | null>),

    /** Day-off exemptions in a date range (admin view, newest first, populated). */
    listByDateRange: (
      filters: { userId?: string; startDate?: string; endDate?: string } = {},
    ): Promise<ExemptionDocument[]> =>
      this.exec('listByDateRange', async () => {
        const conditions = [];
        if (filters.userId) conditions.push(eq(exemptions.user, filters.userId));
        if (filters.startDate) conditions.push(gte(exemptions.date, filters.startDate));
        if (filters.endDate) conditions.push(lte(exemptions.date, filters.endDate));
        const base = this.db
          .select()
          .from(exemptions)
          .orderBy(desc(exemptions.date))
          .limit(500);
        const rows = conditions.length ? await base.where(and(...conditions)) : await base;
        return this.populateMany(this.withIds(rows) as ExemptionDocument[]);
      }),

    countByDate: (date: string): Promise<number> =>
      this.exec('countByDate', () => this.qCount(eq(exemptions.date, date))),

    /** Lightweight date-only listing for trend charts. */
    listDatesInRange: (startDate: string, endDate: string): Promise<Pick<IExemption, 'date'>[]> =>
      this.exec('listDatesInRange', async () => {
        const rows = await this.db
          .select({ date: exemptions.date })
          .from(exemptions)
          .where(and(gte(exemptions.date, startDate), lte(exemptions.date, endDate)));
        return rows as Pick<IExemption, 'date'>[];
      }),

    findByUserAndDate: (userId: string, date: string): Promise<ExemptionDocument | null> =>
      this.exec('findByUserAndDate', () =>
        this.qFindOne(and(eq(exemptions.user, userId), eq(exemptions.date, date))!) as Promise<ExemptionDocument | null>,
      ),
  };
}

export const dayOffRepository = DayOffRepository.getInstance();
