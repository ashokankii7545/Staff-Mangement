import { ValidationError } from '../../shared/errors/app.errors.js';
import { BaseRepository } from '../../shared/repository/base-repository.js';
import {
  MedicineCatalogModel,
  type IMedicineCatalog,
  type MedicineCatalogDocument,
} from './medicine.catalog.model.js';

/**
 * MedicineCatalogRepository – master medicine-list data access.
 */
export class MedicineCatalogRepository extends BaseRepository<IMedicineCatalog> {
  private static instance: MedicineCatalogRepository | null = null;

  private constructor() {
    super(MedicineCatalogModel);
  }

  public static getInstance(): MedicineCatalogRepository {
    if (!MedicineCatalogRepository.instance) {
      MedicineCatalogRepository.instance = new MedicineCatalogRepository();
    }
    return MedicineCatalogRepository.instance;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    /** Admin grid – newest first; optionally include deactivated entries. */
    listAll: (includeInactive = false): Promise<MedicineCatalogDocument[]> =>
      this.exec('listAll', () =>
        MedicineCatalogModel.find(includeInactive ? {} : { isActive: true })
          .sort({ name: 1 })
          .limit(1000)
          .populate('createdBy', 'name employeeId') as Promise<MedicineCatalogDocument[]>,
      ),

    /** Staff autocomplete – active entries only, optional text filter. */
    search: (term?: string): Promise<MedicineCatalogDocument[]> => {
      const filter: Record<string, unknown> = { isActive: true };
      if (term && term.trim()) {
        const rx = new RegExp(term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        // Brand name, salt/composition ya manufacturer – jis se bhi staff ko
        // yaad ho, search mil jaye (Netmeds-style product search).
        filter.$or = [
          { name: rx },
          { genericName: rx },
          { manufacturer: rx },
          { strength: rx },
        ];
      }
      return this.exec('search', () =>
        MedicineCatalogModel.find(filter)
          .sort({ name: 1 })
          .limit(200) as Promise<MedicineCatalogDocument[]>,
      );
    },

    /** Case-insensitive exact-name match – powers "already exists?" checks. */
    findByNameExact: (name: string): Promise<MedicineCatalogDocument | null> =>
      this.exec('findByNameExact', () =>
        MedicineCatalogModel.findOne({
          name: { $regex: `^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        }) as Promise<MedicineCatalogDocument | null>,
      ),

    findById: (id: string): Promise<MedicineCatalogDocument | null> =>
      this.exec('findById', () => MedicineCatalogModel.findById(id)),

    create: (
      data: Partial<IMedicineCatalog> & { createdBy?: string },
    ): Promise<MedicineCatalogDocument> =>
      this.exec(
        'create',
        async () =>
          (await MedicineCatalogModel.create(data as IMedicineCatalog)) as MedicineCatalogDocument,
      ),

    update: (id: string, patch: Partial<IMedicineCatalog>): Promise<MedicineCatalogDocument | null> =>
      this.exec('update', () =>
        MedicineCatalogModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).exec(),
      ),
  };

  /** Soft delete – deactivate so history stays intact but search hides it. */
  public async deactivate(id: string): Promise<MedicineCatalogDocument | null> {
    return this.exec('deactivate', () =>
      MedicineCatalogModel.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true }).exec(),
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
