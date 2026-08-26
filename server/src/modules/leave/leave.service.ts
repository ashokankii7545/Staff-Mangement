import dayjs from 'dayjs';
import { PUBSUB_CHANNELS } from '../../config/constants.js';
import { ValidationError } from '../../shared/errors/app.errors.js';
import { logger } from '../../shared/logger/logger.js';
import { pubsub } from '../../shared/graphql/pubsub.js';
import { dayjs as d, daysBetweenInclusive } from '../../shared/utils/date.util.js';
import { mailService } from '../../shared/mail/mail.service.js';
import { notificationService } from '../notification/notification.service.js';
import { notificationRepository } from '../notification/notification.repository.js';
import { userRepository } from '../user/user.repository.js';
import { settingsRepository } from '../settings/settings.repository.js';
import { leaveRepository } from './leave.repository.js';
import type { LeaveRequestDocument } from './leave.model.js';

export interface LeaveRequestInputShape {
  userId?: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * LEAVE SERVICE – SINGLETON for the full leave lifecycle + accrual engine
 * ────────────────────────────────────────────────────────────────────────────
 * Indian-standard accrual policy:
 *   CL → credits EVERY month (1st) · SL → granted UPFRONT each year
 *   EL → credited EVERY year.
 * Idempotent: Settings.accrualState stores which month/year was last credited,
 * so restarting the server ten times a day can never double-credit anyone.
 */
class LeaveService {
  private static instance: LeaveService | null = null;

  private constructor() {}

  public static getInstance(): LeaveService {
    if (!LeaveService.instance) {
      LeaveService.instance = new LeaveService();
    }
    return LeaveService.instance;
  }

  // ── ACCRUAL ENGINE ────────────────────────────────────────────────────────

  /** Starting balances for a NEW hire, straight from the active policy. */
  public async initialBalancesForNewHire(): Promise<{ casual: number; sick: number; earned: number }> {
    try {
      const s = await settingsRepository.queries.findFirstLean();
      return {
        casual: s?.leavePolicy?.casualPerMonth ?? 1,
        sick: s?.leavePolicy?.sickAnnual ?? 6,
        earned: 0, // EL starts accruing with the next annual credit
      };
    } catch {
      return { casual: 1, sick: 6, earned: 0 };
    }
  }

  /** Idempotent monthly/annual credit sweep – safe to run every few hours. */
  public async runAccrual(): Promise<boolean> {
    const now = d();
    const monthKey = now.format('YYYY-MM');
    const yearKey = now.format('YYYY');

    const settings = await settingsRepository.queries.getOrCreate();

    const state = settings.accrualState ?? ({} as NonNullable<typeof settings.accrualState>);
    const policy = settings.leavePolicy ?? ({} as NonNullable<typeof settings.leavePolicy>);
    const ops: Array<Record<string, unknown>> = [];
    const markers: Record<string, string> = {};

    if (state.lastMonthlyCL !== monthKey) {
      const n = policy.casualPerMonth ?? 1;
      if (n > 0) {
        ops.push({
          updateMany: {
            filter: { isActive: true },
            update: { $inc: { 'leaveBalances.casual': n } },
          },
        });
      }
      markers.lastMonthlyCL = monthKey;
    }

    if (state.lastAnnualSL !== yearKey) {
      const n = policy.sickAnnual ?? 6;
      ops.push({
        updateMany: {
          filter: { isActive: true },
          update: { $set: { 'leaveBalances.sick': n } },
        },
      });
      markers.lastAnnualSL = yearKey;
    }

    if (state.lastAnnualEL !== yearKey) {
      const n = policy.earnedAnnual ?? 12;
      if (n > 0) {
        ops.push({
          updateMany: {
            filter: { isActive: true },
            update: { $inc: { 'leaveBalances.earned': n } },
          },
        });
      }
      markers.lastAnnualEL = yearKey;
    }

    if (ops.length === 0) return false; // nothing due this tick

    for (const op of ops) {
      // eslint-disable-next-line no-await-in-loop
      await userRepository.queries.bulkWrite([op]);
    }

    await settingsRepository.queries.updateAccrualState(String(settings._id), markers);

    logger.info(`Leave accrual applied (${monthKey}): ${ops.length} policy operation(s)`);
    return true;
  }

  // ── QUERIES ───────────────────────────────────────────────────────────────

  public listMine(userId: string): Promise<LeaveRequestDocument[]> {
    return leaveRepository.queries.listMine(userId);
  }

  public listAll(status?: string): Promise<LeaveRequestDocument[]> {
    return leaveRepository.queries.listAll(status);
  }

  /** Admin badge counter for the approvals inbox. */
  public async pendingApprovalsCount(): Promise<number> {
    return leaveRepository.queries.countPending();
  }

  // ── MUTATIONS ─────────────────────────────────────────────────────────────

  public async apply(input: LeaveRequestInputShape, actor: { id: string; role: string }): Promise<LeaveRequestDocument> {
    const targetUserId = actor.role === 'ADMIN' && input.userId ? input.userId : actor.id;

    // ── Date sanity guards ──
    const start = dayjs(input.startDate).startOf('day');
    const end = dayjs(input.endDate).startOf('day');
    if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
      throw new ValidationError('Invalid leave dates – the end date cannot be before the start date.');
    }
    if (start.isBefore(dayjs().startOf('day'))) {
      throw new ValidationError('Leave cannot be applied for a past date.');
    }

    // ── Overlap guard – PENDING or APPROVED leaves block double-booking ──
    const overlapping = await leaveRepository.queries.findOverlapping(
      targetUserId,
      input.startDate,
      input.endDate,
    );
    if (overlapping) {
      throw new ValidationError('A pending or approved leave already covers these dates.');
    }

    // ── Balance guard – a request can never exceed the available balance ──
    // (Admins top-up the balance from Staff Management for exceptional cases.)
    const days = end.diff(start, 'day') + 1;
    const typeKey = String(input.leaveType || '').toLowerCase();
    const staff = await userRepository.queries.findById(targetUserId);
    const available = Number(staff?.leaveBalances?.[typeKey as 'casual' | 'sick' | 'earned']) || 0;
    if (days > available) {
      throw new ValidationError(
        `${staff?.name || 'This staff member'} has only ${available} ${typeKey} leave day(s) left, but ${days} day(s) were requested. Increase the balance from Staff Management if this is intentional.`,
      );
    }

    const leaveRequest = await leaveRepository.queries.create({
      leaveType: input.leaveType as never,
      startDate: input.startDate as never,
      endDate: input.endDate as never,
      reason: input.reason,
      user: targetUserId as never,
      status: 'PENDING',
    });
    await leaveRequest.populate('user');
    pubsub.publish(PUBSUB_CHANNELS.LEAVE_REQUEST_ADDED, { leaveRequestAdded: leaveRequest });

    // Notify every admin so the request surfaces in their inbox instantly.
    // excludeUserId: the ACTOR never gets pinged about their own submission.
    await notificationService.notifyAdmins({
      type: 'LEAVE_REQUEST',
      title: 'New leave request',
      message: `${(leaveRequest.user as unknown as { name: string }).name} applied for ${leaveRequest.leaveType} leave (${d(leaveRequest.startDate).format('MMM D')} – ${d(leaveRequest.endDate).format('MMM D')}).`,
      link: `/approvals?focus=${leaveRequest._id}#leaves`,
      pill: { label: 'LEAVE REQUEST', tone: 'warning' },
      rows: [
        ['Employee', (leaveRequest.user as unknown as { name: string }).name],
        ['Leave Type', leaveRequest.leaveType],
        ['Start Date', d(leaveRequest.startDate).format('MMM D, YYYY')],
        ['End Date', d(leaveRequest.endDate).format('MMM D, YYYY')],
        ...(leaveRequest.reason ? [['Reason', leaveRequest.reason]] : []),
      ] as Array<[string, string]>,
      noteText: 'Please review and approve or reject this leave request.',
      meta: { leaveRequestId: String(leaveRequest._id) },
      excludeUserId: actor.id,
    });

    return leaveRequest;
  }

  /** Staff withdraws their OWN pending/approved leave – admin is always informed. */
  public async cancelMine(id: string, actorId: string): Promise<LeaveRequestDocument> {
    const leaveRequest = await leaveRepository.queries.findByIdPopulatedUser(id);
    if (!leaveRequest) throw new ValidationError('Leave request not found');
    const requesterId = String((leaveRequest.user as unknown as { _id: unknown })._id);
    if (requesterId !== String(actorId)) {
      throw new ValidationError('You can only cancel your own leave requests.');
    }
    if (!['PENDING', 'APPROVED'].includes(leaveRequest.status)) {
      throw new ValidationError('Only pending or approved leaves can be cancelled.');
    }

    const wasApproved = leaveRequest.status === 'APPROVED';
    // Approved leaves already deducted the balance – refund it on cancellation.
    // A bookkeeping failure must NEVER block the cancellation itself.
    if (wasApproved) {
      try {
        const typeKey = leaveRequest.leaveType.toLowerCase();
        const days = daysBetweenInclusive(leaveRequest.startDate, leaveRequest.endDate);
        const staff = await userRepository.queries.findById(requesterId);
        const current = Number(staff?.leaveBalances?.[typeKey as 'casual' | 'sick' | 'earned']) || 0;
        await userRepository.queries.setLeaveBalance(requesterId, typeKey, current + days);
      } catch (balanceErr) {
        logger.error('⚠️ Leave balance refund failed – cancellation STILL applied', balanceErr);
      }
    }

    leaveRequest.status = 'CANCELLED';
    await leaveRequest.save();
    await leaveRequest.populate('user');
    pubsub.publish(PUBSUB_CHANNELS.LEAVE_REQUEST_UPDATED, { leaveRequestUpdated: leaveRequest });

    // Admin is ALWAYS informed – the cancellation lands in their inbox.
    await notificationService.notifyAdmins({
      type: 'LEAVE_REQUEST',
      title: wasApproved ? 'Approved leave cancelled' : 'Leave request withdrawn',
      message: `${(leaveRequest.user as unknown as { name: string }).name} cancelled their ${leaveRequest.leaveType} leave (${d(leaveRequest.startDate).format('MMM D')} – ${d(leaveRequest.endDate).format('MMM D')})${wasApproved ? ' – balance refunded.' : '.'}`,
      link: '/history',
      meta: { leaveRequestId: String(leaveRequest._id) },
    });

    // Close the original "New leave request" admin notifications.
    await notificationRepository.queries.closeMetaNotifications(
      'LEAVE_REQUEST',
      'leaveRequestId',
      String(leaveRequest._id),
    );

    return leaveRequest;
  }

  public async review(
    id: string,
    status: string,
    adminFeedback: string | null | undefined,
    approver: { id: string },
  ): Promise<LeaveRequestDocument> {
    const leaveRequest = await leaveRepository.queries.findByIdPopulatedUser(id);
    if (!leaveRequest) throw new ValidationError('Leave request not found');

    if (leaveRequest.status !== 'PENDING') {
      throw new ValidationError('Leave request is already processed');
    }

    leaveRequest.status = status as LeaveRequestDocument['status'];
    leaveRequest.adminFeedback = adminFeedback ?? undefined;
    leaveRequest.approvedBy = approver.id as never;

    // Deduct balance if approved. A bookkeeping failure must NEVER block the
    // admin's decision – log it loudly and still apply the approval.
    if (status === 'APPROVED') {
      try {
        const requesterId = String((leaveRequest.user as unknown as { _id: unknown })._id);
        const typeKey = leaveRequest.leaveType.toLowerCase();
        const days = daysBetweenInclusive(leaveRequest.startDate, leaveRequest.endDate);
        // Read-modify-write floored at zero – balances can never go negative.
        const staff = await userRepository.queries.findById(requesterId);
        const current =
          Number(staff?.leaveBalances?.[typeKey as 'casual' | 'sick' | 'earned']) || 0;
        await userRepository.queries.setLeaveBalance(requesterId, typeKey, Math.max(0, current - days));
      } catch (balanceErr) {
        logger.error('⚠️ Leave balance deduction failed – approval STILL applied', balanceErr);
      }
    }

    await leaveRequest.save();
    await leaveRequest.populate('approvedBy');
    pubsub.publish(PUBSUB_CHANNELS.LEAVE_REQUEST_UPDATED, { leaveRequestUpdated: leaveRequest });

    // Close the original request notification in EVERY admin's inbox.
    await notificationRepository.queries.closeMetaNotifications(
      'LEAVE_REQUEST',
      'leaveRequestId',
      String(leaveRequest._id),
    );

    // Never ping / email the reviewer about their OWN request (self-review).
    const isSelfReview =
      String((leaveRequest.user as unknown as { _id: unknown })._id) === String(approver.id);

    if (!isSelfReview) {
      const requesterId = String((leaveRequest.user as unknown as { _id: unknown })._id);
      await notificationService.push({
        recipientIds: [requesterId],
        type: 'LEAVE_DECISION',
        title: status === 'APPROVED' ? 'Leave approved' : 'Leave rejected',
        message: `${d(leaveRequest.startDate).format('MMM D')} – ${d(leaveRequest.endDate).format('MMM D')}${adminFeedback ? ` · ${adminFeedback}` : ''}`,
        link: '/leaves',
        meta: { leaveRequestId: String(leaveRequest._id) },
      });

      void mailService
        .sendLeaveDecisionEmail(leaveRequest.user as never, {
          status,
          leaveType: leaveRequest.leaveType,
          startDate: d(leaveRequest.startDate).format('MMM D, YYYY'),
          endDate: d(leaveRequest.endDate).format('MMM D, YYYY'),
          feedback: adminFeedback,
          reviewerName: (leaveRequest.approvedBy as unknown as { name?: string } | null)?.name,
        })
        .catch((e) => logger.error(e));
    }

    return leaveRequest;
  }
}

export const leaveService = LeaveService.getInstance();
