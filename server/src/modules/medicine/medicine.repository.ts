import { desc, eq } from 'drizzle-orm';
import { BaseRepository } from '../../shared/repository/base-repository.js';
import { populateRefs, populateRefsOne } from '../../shared/repository/populate.util.js';
import { medicineRequests } from '../../db/schema/medicine.schema.js';
import type { IMedicineRequest, MedicineRequestDocument } from './medicine.model.js';

const REFS = {
  requestedBy: 'user',
  handledBy: 'user',
  catalogMedicine: 'medicineCatalog',
} as const;

/**
 * MedicineRepository – pharmacy stock-request data access (Postgres/Drizzle).
 * requestedBy/handledBy populate to users, catalogMedicine to a catalog entry.
 */
export class MedicineRepository extends BaseRepository<typeof medicineRequests> {
  private static instance: MedicineRepository | null = null;

  private constructor() {
    super(medicineRequests);
  }

  public static getInstance(): MedicineRepository {
    if (!MedicineRepository.instance) {
      MedicineRepository.instance = new MedicineRepository();
    }
    return MedicineRepository.instance;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    listMine: (userId: string): Promise<MedicineRequestDocument[]> =>
      this.exec('listMine', async () => {
        const rows = await this.db
          .select()
          .from(medicineRequests)
          .where(eq(medicineRequests.requestedBy, userId))
          .orderBy(desc(medicineRequests.createdAt))
          .limit(200);
        return populateRefs(this.withIds(rows), REFS) as Promise<MedicineRequestDocument[]>;
      }),

    listAll: (status?: string): Promise<MedicineRequestDocument[]> =>
      this.exec('listAll', async () => {
        const base = this.db
          .select()
          .from(medicineRequests)
          .orderBy(desc(medicineRequests.createdAt))
          .limit(300);
        const rows = status ? await base.where(eq(medicineRequests.status, status)) : await base;
        return populateRefs(this.withIds(rows), REFS) as Promise<MedicineRequestDocument[]>;
      }),

    findByIdPopulatedRequestedBy: (id: string): Promise<MedicineRequestDocument | null> =>
      this.exec('findByIdPopulatedRequestedBy', async () => {
        const row = (await this.qFindById(id)) as MedicineRequestDocument | null;
        return populateRefsOne(row, { requestedBy: 'user' }) as Promise<MedicineRequestDocument | null>;
      }),

    create: (data: Partial<IMedicineRequest>): Promise<MedicineRequestDocument> =>
      this.exec('create', () => this.qInsert(data) as Promise<MedicineRequestDocument>),

    /** Update status/feedback/handler/image, returning the populated row. */
    updateById: (id: string, patch: Partial<IMedicineRequest>): Promise<MedicineRequestDocument | null> =>
      this.exec('updateById', async () => {
        const row = (await this.qUpdateById(id, patch)) as MedicineRequestDocument | null;
        return populateRefsOne(row, REFS) as Promise<MedicineRequestDocument | null>;
      }),
  };
}

export const medicineRepository = MedicineRepository.getInstance();
