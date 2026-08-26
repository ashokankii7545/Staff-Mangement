import { BaseRepository } from '../../shared/repository/base-repository.js';
import { OfficeModel, type IOffice, type OfficeDocument } from './office.model.js';

/**
 * OfficeRepository – site/branch master data access.
 */
export class OfficeRepository extends BaseRepository<IOffice> {
  private static instance: OfficeRepository | null = null;

  private constructor() {
    super(OfficeModel);
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
      this.exec('listActive', () =>
        OfficeModel.find({ isActive: true }).sort({ createdAt: -1 }) as Promise<OfficeDocument[]>,
      ),

    /** Geofence rotation candidates – order does not matter. */
    listActiveAny: (): Promise<OfficeDocument[]> =>
      this.exec('listActiveAny', () => OfficeModel.find({ isActive: true }) as Promise<OfficeDocument[]>),

    findById: (id: string): Promise<OfficeDocument | null> =>
      this.exec('findById', () => this.qFindById(id) as Promise<OfficeDocument | null>),

    create: (data: Partial<IOffice>): Promise<OfficeDocument> =>
      this.exec('create', async () => (await OfficeModel.create(data as IOffice)) as OfficeDocument),

    updateById: (id: string, data: Partial<IOffice>): Promise<OfficeDocument | null> =>
      this.exec('updateById', () => this.qUpdateOne({ _id: id }, data) as Promise<OfficeDocument | null>),

    /** Soft delete – sites never vanish, they deactivate. */
    softDelete: (id: string): Promise<OfficeDocument | null> =>
      this.exec('softDelete', () => this.qUpdateOne({ _id: id }, { isActive: false })),
  };
}

export const officeRepository = OfficeRepository.getInstance();
