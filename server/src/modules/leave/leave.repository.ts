import { BaseRepository } from '../../shared/repository/base-repository.js';
import {
  LeaveRequestModel,
  type ILeaveRequest,
  type LeaveRequestDocument,
} from './leave.model.js';

/**
 * LeaveRepository – leave request data-access catalog.
 */
export class LeaveRepository extends BaseRepository<ILeaveRequest> {
  private static instance: LeaveRepository | null = null;

  private constructor() {
    super(LeaveRequestModel);
  }

  public static getInstance(): LeaveRepository {
    if (!LeaveRepository.instance) {
      LeaveRepository.instance = new LeaveRepository();
    }
    return LeaveRepository.instance;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    listMine: (userId: string): Promise<LeaveRequestDocument[]> =>
      this.exec('listMine', () =>
        LeaveRequestModel.find({ user: userId })
          .sort({ createdAt: -1 })
          .populate('user')
          .populate('approvedBy') as Promise<LeaveRequestDocument[]>,
      ),

    listAll: (status?: string): Promise<LeaveRequestDocument[]> =>
      this.exec('listAll', () => {
        const filter: Record<string, unknown> = {};
        if (status) filter.status = status;
        return LeaveRequestModel.find(filter)
          .sort({ createdAt: -1 })
          .populate('user')
          .populate('approvedBy') as Promise<LeaveRequestDocument[]>;
      }),

    countPending: (): Promise<number> => this.exec('countPending', () => this.qCount({ status: 'PENDING' })),

    /** Overlap guard – PENDING/APPROVED leaves block double-booking. */
    findOverlapping: (
      userId: string,
      startDate: string | Date,
      endDate: string | Date,
    ): Promise<LeaveRequestDocument | null> =>
      this.exec('findOverlapping', () =>
        LeaveRequestModel.findOne({
          user: userId,
          status: { $in: ['PENDING', 'APPROVED'] },
          startDate: { $lte: endDate },
          endDate: { $gte: startDate },
        }) as Promise<LeaveRequestDocument | null>,
      ),

    findById: (id: string): Promise<LeaveRequestDocument | null> =>
      this.exec('findById', () => this.qFindById(id) as Promise<LeaveRequestDocument | null>),

    findByIdPopulatedUser: (id: string): Promise<LeaveRequestDocument | null> =>
      this.exec('findByIdPopulatedUser', async () => {
        const doc = await this.qFindById(id);
        return doc ? ((await doc.populate('user')) as LeaveRequestDocument) : null;
      }),

    create: (data: Partial<ILeaveRequest>): Promise<LeaveRequestDocument> =>
      this.exec(
        'create',
        async () => (await LeaveRequestModel.create(data as ILeaveRequest)) as LeaveRequestDocument,
      ),
  };
}

export const leaveRepository = LeaveRepository.getInstance();
