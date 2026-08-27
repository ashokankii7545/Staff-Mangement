import { desc, eq } from 'drizzle-orm';
import { BaseRepository } from '../../shared/repository/base-repository.js';
import { offices } from '../../db/schema/office.schema.js';
import type { IOffice, OfficeDocument } from './office.model.js';

/**
 * OfficeRepository – site/branch master data access (Postgres/Drizzle).
 * Public `queries` catalog signatures are unchanged from the Mongoose version.
 */
export class OfficeRepository extends BaseRepository<typeof offices> {
  private static instance: OfficeRepository | null = null;

  private constructor() {
    super(offices);
  }

  public static getInstance(): OfficeRepository {
    if (!OfficeRepository.instance) {
      OfficeRepository.instance = new OfficeRepository();
    }
    return OfficeRepository.instance;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    /** Public listing (newest first). */
    listActive: (): Promise<OfficeDocument[]> =>
      this.exec('listActive', async () => {
        const rows = await this.db
          .select()
          .from(offices)
          .where(eq(offices.isActive, true))
          .orderBy(desc(offices.createdAt));
        return this.withIds(rows) as OfficeDocument[];
      }),

    /** Geofence rotation candidates – order does not matter. */
    listActiveAny: (): Promise<OfficeDocument[]> =>
      this.exec('listActiveAny', () =>
        this.qFindMany(eq(offices.isActive, true)) as Promise<OfficeDocument[]>,
      ),

    findById: (id: string): Promise<OfficeDocument | null> =>
      this.exec('findById', () => this.qFindById(id) as Promise<OfficeDocument | null>),

    create: (data: Partial<IOffice>): Promise<OfficeDocument> =>
      this.exec('create', () => this.qInsert(data) as Promise<OfficeDocument>),

    updateById: (id: string, data: Partial<IOffice>): Promise<OfficeDocument | null> =>
      this.exec('updateById', () => this.qUpdateById(id, data) as Promise<OfficeDocument | null>),

    /** Soft delete – sites never vanish, they deactivate. */
    softDelete: (id: string): Promise<OfficeDocument | null> =>
      this.exec('softDelete', () => this.qUpdateById(id, { isActive: false }) as Promise<OfficeDocument | null>),
  };
}

export const officeRepository = OfficeRepository.getInstance();
