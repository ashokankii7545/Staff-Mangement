import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { ValidationError } from '../../shared/errors/app.errors.js';
import { BaseRepository } from '../../shared/repository/base-repository.js';
import { medicineCatalog } from '../../db/schema/medicine-catalog.schema.js';
import type { IMedicineCatalog, MedicineCatalogDocument } from './medicine.catalog.model.js';

/** Escape a user string for use as a literal inside an ILIKE pattern. */
const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/**
 * MedicineCatalogRepository – master medicine-list data access (Postgres/Drizzle).
 * `createdBy` is returned as a uuid; the resolver/loader populates it.
 */
export class MedicineCatalogRepository extends BaseRepository<typeof medicineCatalog> {
  private static instance: MedicineCatalogRepository | null = null;

  private constructor() {
    super(medicineCatalog);
  }

  public static getInstance(): MedicineCatalogRepository {
    if (!MedicineCatalogRepository.instance) {
      MedicineCatalogRepository.instance = new MedicineCatalogRepository();
    }
    return MedicineCatalogRepository.instance;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    /** Admin grid – A→Z; optionally include deactivated entries. */
    listAll: (includeInactive = false): Promise<MedicineCatalogDocument[]> =>
      this.exec('listAll', async () => {
        const base = this.db
          .select()
          .from(medicineCatalog)
          .orderBy(asc(medicineCatalog.name))
          .limit(1000);
        const rows = includeInactive ? await base : await base.where(eq(medicineCatalog.isActive, true));
        return this.withIds(rows) as MedicineCatalogDocument[];
      }),

    /**
     * Admin grid – server-side paginated + searchable. Mirrors the users
     * paginated pattern: returns { data, pageInfo }.
     */
    listPaginated: (
      pagination: { page?: number; limit?: number; search?: string } = {},
      includeInactive = false,
    ) =>
      this.exec('listPaginated', async () => {
        const page = Math.max(1, pagination.page || 1);
        const limit = Math.max(1, pagination.limit || 10);
        const offset = (page - 1) * limit;

        const conditions = [];
        if (!includeInactive) conditions.push(eq(medicineCatalog.isActive, true));
        if (pagination.search && pagination.search.trim()) {
          const pat = `%${escapeLike(pagination.search.trim())}%`;
          conditions.push(
            or(
              ilike(medicineCatalog.name, pat),
              ilike(medicineCatalog.genericName, pat),
              ilike(medicineCatalog.manufacturer, pat),
              ilike(medicineCatalog.strength, pat),
            )!,
          );
        }
        const where = conditions.length ? and(...conditions) : undefined;

        const countBase = this.db.select({ count: sql<number>`count(*)::int` }).from(medicineCatalog);
        const dataBase = this.db
          .select()
          .from(medicineCatalog)
          .orderBy(asc(medicineCatalog.name))
          .limit(limit)
          .offset(offset);

        const [countRows, data] = await Promise.all([
          where ? countBase.where(where) : countBase,
          where ? dataBase.where(where) : dataBase,
        ]);

        const totalCount = countRows[0]?.count ?? 0;
        const totalPages = Math.ceil(totalCount / limit);

        return {
          data: this.withIds(data) as MedicineCatalogDocument[],
          pageInfo: {
            totalCount,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
          },
        };
      }),

    /** Staff autocomplete – active entries only, optional text filter. */
    search: (term?: string): Promise<MedicineCatalogDocument[]> =>
      this.exec('search', async () => {
        const conditions = [eq(medicineCatalog.isActive, true)];
        if (term && term.trim()) {
          const pat = `%${escapeLike(term.trim())}%`;
          conditions.push(
            or(
              ilike(medicineCatalog.name, pat),
              ilike(medicineCatalog.genericName, pat),
              ilike(medicineCatalog.manufacturer, pat),
              ilike(medicineCatalog.strength, pat),
            )!,
          );
        }
        const rows = await this.db
          .select()
          .from(medicineCatalog)
          .where(and(...conditions))
          .orderBy(asc(medicineCatalog.name))
          .limit(200);
        return this.withIds(rows) as MedicineCatalogDocument[];
      }),

    /** Case-insensitive exact-name match – powers "already exists?" checks. */
    findByNameExact: (name: string): Promise<MedicineCatalogDocument | null> =>
      this.exec('findByNameExact', () =>
        this.qFindOne(
          sql`lower(${medicineCatalog.name}) = lower(${name.trim()})`,
        ) as Promise<MedicineCatalogDocument | null>,
      ),

    findById: (id: string): Promise<MedicineCatalogDocument | null> =>
      this.exec('findById', () => this.qFindById(id) as Promise<MedicineCatalogDocument | null>),

    create: (
      data: Partial<IMedicineCatalog> & { createdBy?: string },
    ): Promise<MedicineCatalogDocument> =>
      this.exec('create', () => this.qInsert(data) as Promise<MedicineCatalogDocument>),

    update: (id: string, patch: Partial<IMedicineCatalog>): Promise<MedicineCatalogDocument | null> =>
      this.exec('update', () => this.qUpdateById(id, patch) as Promise<MedicineCatalogDocument | null>),
  };

  /** Soft delete – deactivate so history stays intact but search hides it. */
  public async deactivate(id: string): Promise<MedicineCatalogDocument | null> {
    return this.exec('deactivate', () =>
      this.qUpdateById(id, { isActive: false }) as Promise<MedicineCatalogDocument | null>,
    );
  }

  /** Guard against duplicate catalogue names (case-insensitive). */
  public static assertName(name: string): string {
    const clean = String(name || '').trim();
    if (!clean) throw new ValidationError('Medicine name is required.');
    if (clean.length > 120) throw new ValidationError('Medicine name is too long (max 120 chars).');
    return clean;
  }
}

export const medicineCatalogRepository = MedicineCatalogRepository.getInstance();
