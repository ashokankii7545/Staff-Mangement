import { BaseRepository } from '../../shared/repository/base-repository.js';
import {
  MedicineRequestModel,
  type IMedicineRequest,
  type MedicineRequestDocument,
} from './medicine.model.js';

/**
 * MedicineRepository – pharmacy stock-request data access.
 */
export class MedicineRepository extends BaseRepository<IMedicineRequest> {
  private static instance: MedicineRepository | null = null;

  private constructor() {
    super(MedicineRequestModel);
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
      this.exec('listMine', () =>
        MedicineRequestModel.find({ requestedBy: userId })
          .sort({ createdAt: -1 })
          .limit(200)
          .populate('requestedBy')
          .populate('handledBy')
          .populate('catalogMedicine', 'name strength image') as Promise<MedicineRequestDocument[]>,
      ),

    listAll: (status?: string): Promise<MedicineRequestDocument[]> =>
      this.exec('listAll', () => {
        const filter: Record<string, unknown> = {};
        if (status) filter.status = status;
        return MedicineRequestModel.find(filter)
          .sort({ createdAt: -1 })
          .limit(300)
          .populate('requestedBy')
          .populate('handledBy')
          .populate('catalogMedicine', 'name strength image') as Promise<MedicineRequestDocument[]>;
      }),

    findByIdPopulatedRequestedBy: (id: string): Promise<MedicineRequestDocument | null> =>
      this.exec('findByIdPopulatedRequestedBy', async () => {
        const doc = await MedicineRequestModel.findById(id);
        return doc ? ((await doc.populate('requestedBy')) as MedicineRequestDocument) : null;
      }),

    create: (data: Partial<IMedicineRequest>): Promise<MedicineRequestDocument> =>
      this.exec(
        'create',
        async () => (await MedicineRequestModel.create(data as IMedicineRequest)) as MedicineRequestDocument,
      ),
  };
}

export const medicineRepository = MedicineRepository.getInstance();
