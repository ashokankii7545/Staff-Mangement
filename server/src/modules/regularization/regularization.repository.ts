import { BaseRepository } from '../../shared/repository/base-repository.js';
import {
  RegularizationModel,
  type IRegularization,
  type RegularizationDocument,
} from './regularization.model.js';

/**
 * RegularizationRepository – punch-correction request data access.
 */
export class RegularizationRepository extends BaseRepository<IRegularization> {
  private static instance: RegularizationRepository | null = null;

  private constructor() {
    super(RegularizationModel);
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
      this.exec('listMine', () =>
        RegularizationModel.find({ user: userId })
          .sort({ createdAt: -1 })
          .populate('user')
          .populate('approvedBy') as Promise<RegularizationDocument[]>,
      ),

    listAll: (status?: string): Promise<RegularizationDocument[]> =>
      this.exec('listAll', () => {
        const filter: Record<string, unknown> = {};
        if (status) filter.status = status;
        return RegularizationModel.find(filter)
          .sort({ createdAt: -1 })
          .populate('user')
          .populate('approvedBy') as Promise<RegularizationDocument[]>;
      }),

    findByIdPopulatedUser: (id: string): Promise<RegularizationDocument | null> =>
      this.exec('findByIdPopulatedUser', async () => {
        const doc = await this.qFindById(id);
        return doc ? ((await doc.populate('user')) as RegularizationDocument) : null;
      }),

    /** Duplicate guard – same day, not previously rejected. */
    findDuplicateForDay: (userId: string, date: string): Promise<RegularizationDocument | null> =>
      this.exec('findDuplicateForDay', () =>
        RegularizationModel.findOne({
          user: userId,
          date,
          status: { $ne: 'REJECTED' },
        }) as Promise<RegularizationDocument | null>,
      ),

    /** Auto-approve sweep candidates. */
    listStalePending: (cutoff: Date): Promise<RegularizationDocument[]> =>
      this.exec('listStalePending', () =>
        RegularizationModel.find({
          status: 'PENDING',
          createdAt: { $lt: cutoff },
        }).populate('user') as Promise<RegularizationDocument[]>,
      ),

    create: (data: Partial<IRegularization>): Promise<RegularizationDocument> =>
      this.exec(
        'create',
        async () => (await RegularizationModel.create(data as IRegularization)) as RegularizationDocument,
      ),
  };
}

export const regularizationRepository = RegularizationRepository.getInstance();
