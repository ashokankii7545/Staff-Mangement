import { and, desc, eq, lt, ne } from 'drizzle-orm';
import { BaseRepository } from '../../shared/repository/base-repository.js';
import { populateRefs, populateRefsOne } from '../../shared/repository/populate.util.js';
import { regularizations } from '../../db/schema/regularization.schema.js';
import type { IRegularization, RegularizationDocument } from './regularization.model.js';

const REFS = { user: 'user', approvedBy: 'user' } as const;

/**
 * RegularizationRepository – punch-correction request data access (Postgres/Drizzle).
 */
export class RegularizationRepository extends BaseRepository<typeof regularizations> {
  private static instance: RegularizationRepository | null = null;

  private constructor() {
    super(regularizations);
  }

  public static getInstance(): RegularizationRepository {
    if (!RegularizationRepository.instance) {
      RegularizationRepository.instance = new RegularizationRepository();
    }
    return RegularizationRepository.instance;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    listMine: (userId: string): Promise<RegularizationDocument[]> =>
      this.exec('listMine', async () => {
        const rows = await this.db
          .select()
          .from(regularizations)
          .where(eq(regularizations.user, userId))
          .orderBy(desc(regularizations.createdAt));
        return populateRefs(this.withIds(rows), REFS) as Promise<RegularizationDocument[]>;
      }),

    listAll: (status?: string): Promise<RegularizationDocument[]> =>
      this.exec('listAll', async () => {
        const base = this.db.select().from(regularizations).orderBy(desc(regularizations.createdAt));
        const rows = status ? await base.where(eq(regularizations.status, status)) : await base;
        return populateRefs(this.withIds(rows), REFS) as Promise<RegularizationDocument[]>;
      }),

    findById: (id: string): Promise<RegularizationDocument | null> =>
      this.exec('findById', () => this.qFindById(id) as Promise<RegularizationDocument | null>),

    findByIdPopulatedUser: (id: string): Promise<RegularizationDocument | null> =>
      this.exec('findByIdPopulatedUser', async () => {
        const row = (await this.qFindById(id)) as RegularizationDocument | null;
        return populateRefsOne(row, { user: 'user' }) as Promise<RegularizationDocument | null>;
      }),

    /** Duplicate guard – same day, not previously rejected. */
    findDuplicateForDay: (userId: string, date: string): Promise<RegularizationDocument | null> =>
      this.exec('findDuplicateForDay', () =>
        this.qFindOne(
          and(
            eq(regularizations.user, userId),
            eq(regularizations.date, date),
            ne(regularizations.status, 'REJECTED'),
          )!,
        ) as Promise<RegularizationDocument | null>,
      ),

    /** Auto-approve sweep candidates (PENDING older than cutoff), populated user. */
    listStalePending: (cutoff: Date): Promise<RegularizationDocument[]> =>
      this.exec('listStalePending', async () => {
        const rows = await this.db
          .select()
          .from(regularizations)
          .where(and(eq(regularizations.status, 'PENDING'), lt(regularizations.createdAt, cutoff)));
        return populateRefs(this.withIds(rows), { user: 'user' }) as Promise<RegularizationDocument[]>;
      }),

    create: (data: Partial<IRegularization>): Promise<RegularizationDocument> =>
      this.exec('create', () => this.qInsert(data) as Promise<RegularizationDocument>),

    /** Update status/feedback/approver, returning the populated row. */
    updateById: (id: string, patch: Partial<IRegularization>): Promise<RegularizationDocument | null> =>
      this.exec('updateById', async () => {
        const row = (await this.qUpdateById(id, patch)) as RegularizationDocument | null;
        return populateRefsOne(row, REFS) as Promise<RegularizationDocument | null>;
      }),
  };
}

export const regularizationRepository = RegularizationRepository.getInstance();
