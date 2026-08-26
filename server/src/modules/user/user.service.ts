import dayjs from 'dayjs';
import { ValidationError, NotFoundError } from '../../shared/errors/app.errors.js';
import { logger } from '../../shared/logger/logger.js';
import { mailService } from '../../shared/mail/mail.service.js';
import { notificationService } from '../notification/notification.service.js';
import { userRepository } from './user.repository.js';
import { dayOffRepository } from '../day-off/day-off.repository.js';
import { officeRepository } from '../office/office.repository.js';
import type { IUserDocument } from './user.model.js';

export interface UpdateUserInputShape {
  name?: string;
  email?: string;
  department?: string;
  role?: string;
  officeId?: string;
  leaveBalances?: { casual?: number; sick?: number; earned?: number };
  shiftStartTime?: string;
  shiftEndTime?: string;
  restrictedPages?: string[];
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * USER SERVICE – SINGLETON for staff directory, profile & day-off management
 * ────────────────────────────────────────────────────────────────────────────
 */
class UserService {
  private static instance: UserService | null = null;

  private constructor() {}

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  public async me(userId: string): Promise<IUserDocument | null> {
    return userRepository.queries.findById(userId);
  }

  public listUsers(filters: { isActive?: boolean } = {}): Promise<IUserDocument[]> {
    return userRepository.queries.listUsers(filters);
  }

  public getUser(id: string): Promise<IUserDocument | null> {
    return userRepository.queries.findById(id, { populate: ['assignedOffice'] });
  }

  /** Self-signups waiting for an admin decision. */
  public listPendingUsers(): Promise<IUserDocument[]> {
    return userRepository.queries.listPendingSignups();
  }

  public async updateUser(id: string, input: UpdateUserInputShape): Promise<IUserDocument | null> {
    const updateData: Record<string, unknown> = { ...input };
    if (updateData.officeId) {
      updateData.assignedOffice = updateData.officeId;
      delete updateData.officeId;
    }
    const updated = await userRepository.queries.updateById(id, updateData, {
      populate: ['assignedOffice'],
    });
    if (updated) void mailService.sendProfileUpdateEmail(updated).catch((e) => logger.error(e));
    return updated;
  }

  /**
   * Guard-rails: ADMIN accounts can never be deactivated (prevents a full
   * admin lock-out) and you cannot deactivate your own account.
   */
  public async toggleActive(userId: string, actorId: string): Promise<IUserDocument> {
    const target = await userRepository.queries.findById(userId, { populate: ['assignedOffice'] });
    if (!target) throw new NotFoundError('User not found');
    if (target.role === 'ADMIN') {
      throw new ValidationError('Admin accounts cannot be deactivated.');
    }
    if (String(target._id) === String(actorId)) {
      throw new ValidationError('You cannot deactivate your own account.');
    }

    target.isActive = !target.isActive;
    await target.save();
    void mailService.sendAccountStatusEmail(target, { isActive: target.isActive }).catch((e) => logger.error(e));
    return target;
  }

  /** Persist the UI theme so it follows the user across devices & re-logins. */
  public async setThemePreference(userId: string, mode: string): Promise<IUserDocument | null> {
    if (!['light', 'dark', 'system'].includes(mode)) {
      throw new ValidationError(`Invalid theme "${mode}".`);
    }
    return userRepository.queries.setThemePreference(userId, mode);
  }

  // ── TEMPORARY DUTY ────────────────────────────────────────────────────────

  /**
   * TEMPORARY duty reassignment – staff can punch at another site between
   * dates WITHOUT touching their permanent assignment.
   */
  public async assignTemporaryDuty(args: {
    userId: string;
    officeId: string;
    startDate: Date;
    endDate: Date;
    reason?: string | null;
  }): Promise<IUserDocument> {
    const office = await officeRepository.queries.findById(args.officeId);
    if (!office) throw new ValidationError('Office not found.');

    const start = dayjs(args.startDate).startOf('day');
    const end = dayjs(args.endDate).endOf('day');
    if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
      throw new ValidationError('Invalid temporary-duty date range.');
    }

    const target = await userRepository.queries.findById(args.userId);
    if (!target) throw new ValidationError('User not found.');

    target.temporaryAssignment = {
      office: office._id as never,
      startDate: start.toDate(),
      endDate: end.toDate(),
      reason: args.reason || '',
    };
    await target.save();

    await notificationService.push({
      recipientIds: [String(target._id)],
      type: 'TEMP_DUTY',
      title: `Temporary duty assigned: ${office.name}`,
      message: `${start.format('MMM D')} – ${end.format('MMM D')}${args.reason ? ` · ${args.reason}` : ''}. Your attendance will be marked at this site.`,
      link: '/attendance',
    });

    void mailService
      .sendTemporaryDutyEmail(target, {
        officeName: office.name,
        startDate: start.format('MMM D, YYYY'),
        endDate: end.format('MMM D, YYYY'),
        reason: args.reason,
      })
      .catch((e) => logger.error(e));

    const populated = await userRepository.queries.findById(String(target._id), {
      populate: ['assignedOffice', 'temporaryAssignment.office'],
    });
    return populated ?? target;
  }

  public async clearTemporaryDuty(userId: string): Promise<IUserDocument | null> {
    const previous = await userRepository.queries.findById(userId, {
      populate: ['temporaryAssignment.office'],
    });
    if (!previous) throw new ValidationError('User not found.');

    const clearedOfficeName =
      (previous.temporaryAssignment?.office as unknown as { name?: string })?.name || 'the site';

    const target = await userRepository.queries.updateById(
      userId,
      { $set: { temporaryAssignment: { office: null, startDate: null, endDate: null, reason: '' } } },
      { populate: ['assignedOffice', 'temporaryAssignment.office'] },
    );

    void mailService
      .sendTemporaryDutyEmail(target ?? {}, { officeName: clearedOfficeName, cleared: true })
      .catch((e) => logger.error(e));
    return target;
  }

  // ── DAY-OFF (EXEMPTIONS) ─────────────────────────────────────────────────

  /** Day-off exemptions in a date range (admin view). */
  public listDayOffs(filters: { startDate?: string; endDate?: string } = {}) {
    return dayOffRepository.queries.listByDateRange(filters);
  }

  /** Grant a staff member a day off (excluded from absence stats). */
  public async grantDayOff(args: {
    userId: string;
    date: string;
    reason?: string | null;
    actorId: string;
  }): Promise<unknown> {
    const cleanDate = dayjs(args.date).format('YYYY-MM-DD');

    let exemption = await dayOffRepository.queries.upsertByUserAndDate(
      args.userId,
      cleanDate,
      args.reason ?? '',
      args.actorId,
    );
    exemption = await exemption.populate(['user', 'createdBy']);

    await notificationService.push({
      recipientIds: [args.userId],
      type: 'DAY_OFF',
      title: `Day off granted: ${dayjs(cleanDate).format('ddd, MMM D')}`,
      message: args.reason || 'You are not required to mark attendance on this day.',
      link: '/attendance',
    });

    void mailService
      .sendDayOffEmail(exemption.user as never, {
        date: dayjs(cleanDate).format('MMM D, YYYY'),
        reason: args.reason,
      })
      .catch((e) => logger.error(e));

    return exemption;
  }

  public async revokeDayOff(id: string): Promise<boolean> {
    // Fetch before delete so we can still tell the staff member what was revoked.
    const exemption = await dayOffRepository.queries.findByIdPopulated(id);
    const deleted = await dayOffRepository.queries.deleteById(id);
    if (deleted && exemption?.user) {
      void mailService
        .sendDayOffEmail(exemption.user as never, {
          date: dayjs(exemption.date).format('MMM D, YYYY'),
          revoked: true,
        })
        .catch((e) => logger.error(e));
    }
    return !!deleted;
  }

  /** Org-wide announcement email to all active staff. */
  public async broadcast(subject: string, message: string): Promise<boolean> {
    await mailService.sendBroadcastEmail(subject, message);
    return true;
  }

  /** GraphQL helper: resolve assignedOffice even when only the id is present. */
  public async resolveAssignedOffice(parent: IUserDocument): Promise<unknown> {
    const ref = parent.assignedOffice;
    if (!ref) return null;
    if ((ref as unknown as { _id?: unknown })._id) return ref; // already populated
    return officeRepository.queries.findById(String(ref));
  }

  /** GraphQL helper: resolve temp-assignment office similarly. */
  public async resolveTempAssignment(parent: IUserDocument): Promise<unknown> {
    const ta = parent.temporaryAssignment;
    if (!ta || !ta.office) return null;
    if ((ta.office as unknown as { _id?: unknown })._id) return ta; // already populated
    const office = await officeRepository.queries.findById(String(ta.office));
    return office ? ta : null;
  }

  /** Default balances surfaced when a legacy document lacks them. */
  public static defaultLeaveBalances(
    parent: IUserDocument,
  ): { casual: number; sick: number; earned: number } {
    if (!parent.leaveBalances) return { casual: 12, sick: 6, earned: 0 };
    return {
      casual: parent.leaveBalances.casual ?? 12,
      sick: parent.leaveBalances.sick ?? 6,
      earned: parent.leaveBalances.earned ?? 0,
    };
  }
}

export const userService = UserService.getInstance();
