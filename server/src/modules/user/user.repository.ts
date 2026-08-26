import type { FilterQuery } from 'mongoose';
import { BaseRepository } from '../../shared/repository/base-repository.js';
import { UserModel, type IUser, type IUserDocument } from './user.model.js';

/** Options accepted by catalog entries that can populate refs. */
export interface FindUserOptions {
  populate?: Array<'assignedOffice' | 'temporaryAssignment.office'>;
}

/**
 * UserRepository – ALL database access for the user module lives here.
 * The `queries` object is a catalog of named dynamic queries; services call
 * e.g. `userRepository.queries.findByEmail(email)` and never touch Mongoose.
 */
export class UserRepository extends BaseRepository<IUser> {
  private static instance: UserRepository | null = null;

  // Singleton – one repository instance per process.
  private constructor() {
    super(UserModel);
  }

  public static getInstance(): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository();
    }
    return UserRepository.instance;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    findById: (id: string, options: FindUserOptions = {}): Promise<IUserDocument | null> =>
      this.exec('findById', async () => {
        let query = UserModel.findById(id);
        for (const path of options.populate ?? []) {
          query = query.populate(path);
        }
        return query as Promise<IUserDocument | null>;
      }),

    findByIdentifier: (identifier: string): Promise<IUserDocument | null> =>
      this.findOneExec({ $or: [{ email: identifier.toLowerCase() }, { employeeId: identifier }] }),

    findByEmail: (email: string): Promise<IUserDocument | null> =>
      this.findOneExec({ email: email.toLowerCase() }),

    findByEmployeeId: (employeeId: string): Promise<IUserDocument | null> =>
      this.findOneExec({ employeeId: String(employeeId).trim().toUpperCase() }),

    findByGoogleIdOrEmail: (googleId: string, email: string): Promise<IUserDocument | null> =>
      this.findOneExec({ $or: [{ googleId }, { email }] }),

    existsByEmployeeId: (employeeId: string): Promise<boolean> =>
      this.exec('existsByEmployeeId', () => this.qExists({ employeeId })),

    existsByEmail: (email: string): Promise<boolean> =>
      this.exec('existsByEmail', () => this.qExists({ email: email.toLowerCase() })),

    /** Active, fully-approved staff accounts (reminder sweeps). */
    listActiveStaff: (): Promise<IUserDocument[]> =>
      this.exec('listActiveStaff', () =>
        UserModel.find({ role: 'STAFF', isActive: true, approvalStatus: 'APPROVED' }).select(
          '_id name',
        ) as Promise<IUserDocument[]>,
      ),

    findActiveAdmins: (): Promise<IUserDocument[]> =>
      this.exec('findActiveAdmins', () =>
        UserModel.find({ role: 'ADMIN', isActive: true }).select('_id email name') as Promise<IUserDocument[]>,
      ),

    findActiveAdminEmails: (): Promise<string[]> =>
      this.exec('findActiveAdminEmails', async () => {
        const admins = await UserModel.find({ role: 'ADMIN', isActive: true }).select('email');
        return admins.map((a) => a.email).filter(Boolean);
      }),

    findActiveStaffEmails: (): Promise<string[]> =>
      this.exec('findActiveStaffEmails', async () => {
        const staff = await UserModel.find({ isActive: true }).select('email');
        return staff.map((u) => u.email).filter(Boolean);
      }),

    countActiveStaff: (): Promise<number> =>
      this.exec('countActiveStaff', () => this.qCount({ role: 'STAFF', isActive: true })),

    create: (data: Partial<IUser>): Promise<IUserDocument> =>
      this.exec('create', async () => (await UserModel.create(data as IUser)) as IUserDocument),

    deleteById: (id: string): Promise<IUserDocument | null> =>
      this.exec('deleteById', () => this.qDeleteById(id)),

    /** Generic partial update (profile edits, approval flows…). */
    updateById: (
      id: string,
      update: Record<string, unknown>,
      options: FindUserOptions = {},
    ): Promise<IUserDocument | null> =>
      this.exec('updateById', async () => {
        let query = UserModel.findByIdAndUpdate(id, update, { new: true });
        for (const path of options.populate ?? []) {
          query = query.populate(path);
        }
        return query as Promise<IUserDocument | null>;
      }),

    /** Admin directory listing, optionally filtered by active state. */
    listUsers: (filters: { isActive?: boolean } = {}): Promise<IUserDocument[]> =>
      this.exec('listUsers', async () => {
        const filter: Record<string, unknown> = {};
        if (filters.isActive !== undefined) filter.isActive = filters.isActive;
        return UserModel.find(filter)
          .populate('assignedOffice')
          .sort({ name: 1 }) as Promise<IUserDocument[]>;
      }),

    listUsersPaginated: (
      pagination: { page?: number; limit?: number; search?: string } = {},
      isActive?: boolean
    ) => this.exec('listUsersPaginated', async () => {
      const page = Math.max(1, pagination.page || 1);
      const limit = Math.max(1, pagination.limit || 10);
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = {};
      if (isActive !== undefined) filter.isActive = isActive;
      
      if (pagination.search) {
        const regex = new RegExp(pagination.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [
          { name: regex },
          { email: regex },
          { employeeId: regex }
        ];
      }

      const [totalCount, data] = await Promise.all([
        UserModel.countDocuments(filter),
        UserModel.find(filter)
          // Notice we don't .populate('assignedOffice') here, relying on DataLoader instead!
          .sort({ name: 1 })
          .skip(skip)
          .limit(limit) as Promise<IUserDocument[]>
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return {
        data,
        pageInfo: {
          totalCount,
          currentPage: page,
          totalPages,
          hasNextPage: page < totalPages,
        }
      };
    }),

    /** Self-signups waiting for an admin decision. */
    listPendingSignups: (): Promise<IUserDocument[]> =>
      this.exec('listPendingSignups', () =>
        UserModel.find({ approvalStatus: 'PENDING', role: 'STAFF' })
          .populate('assignedOffice')
          .sort({ createdAt: 1 }) as Promise<IUserDocument[]>,
      ),

    /** Persist the UI theme so it follows the user across devices. */
    setThemePreference: (userId: string, mode: string): Promise<IUserDocument | null> =>
      this.exec('setThemePreference', () =>
        UserModel.findByIdAndUpdate(userId, { themePreference: mode }, { new: true }),
      ),

    /** Leave bookkeeping – write an exact floored balance for one leave type. */
    setLeaveBalance: (
      userId: string,
      typeKey: string,
      value: number,
    ): Promise<IUserDocument | null> =>
      this.exec('setLeaveBalance', () =>
        UserModel.findByIdAndUpdate(
          userId,
          { $set: { [`leaveBalances.${typeKey}`]: Math.max(0, Math.floor(value)) } },
          { new: true },
        ),
      ),

    /**
     * ⚡ ATOMIC guard-decrement (race-proof):
     * Succeeds ONLY if the stored balance is still >= days at the moment of
     * the update. Two concurrent approvals can never both pass this.
     */
    deductLeaveBalanceIfAvailable: (
      userId: string,
      typeKey: string,
      days: number,
    ): Promise<boolean> =>
      this.exec('deductLeaveBalanceIfAvailable', async () => {
        const res = await UserModel.updateOne(
          { _id: userId, [`leaveBalances.${typeKey}`]: { $gte: days } },
          { $inc: { [`leaveBalances.${typeKey}`]: -days } },
        );
        return res.modifiedCount > 0;
      }),

    /** ⚡ ATOMIC increment/refund (no read-modify-write window). */
    addLeaveBalance: (
      userId: string,
      typeKey: string,
      days: number,
    ): Promise<unknown> =>
      this.exec('addLeaveBalance', () =>
        UserModel.updateOne(
          { _id: userId },
          { $inc: { [`leaveBalances.${typeKey}`]: days } },
        ),
      ),

    /** Accrual engine – run pre-built bulk operations. */
    bulkWrite: (ops: Array<Record<string, unknown>>): Promise<unknown> =>
      this.exec('bulkWrite', () => UserModel.bulkWrite(ops as never)),
  };

  /** Small helper so every catalog entry funnels through the shared executor. */
  private findOneExec(filter: FilterQuery<IUser>): Promise<IUserDocument | null> {
    return this.exec('findOne', () => UserModel.findOne(filter) as Promise<IUserDocument | null>);
  }
}

export const userRepository = UserRepository.getInstance();
