import dayjs from 'dayjs';
import { PUBSUB_CHANNELS } from '../../config/constants.js';
import { ValidationError } from '../../shared/errors/app.errors.js';
import { logger } from '../../shared/logger/logger.js';
import { pubsub } from '../../shared/graphql/pubsub.js';
import { dayjs as d } from '../../shared/utils/date.util.js';
import { mailService } from '../../shared/mail/mail.service.js';
import { notificationService } from '../notification/notification.service.js';
import { notificationRepository } from '../notification/notification.repository.js';
import { settingsRepository } from '../settings/settings.repository.js';
import { attendanceRepository } from '../attendance/attendance.repository.js';
import type { AttendanceDocument } from '../attendance/attendance.model.js';
import { regularizationRepository } from './regularization.repository.js';
import type { RegularizationDocument } from './regularization.model.js';

export interface RegularizationInputShape {
  date: string;
  checkInTime: string;
  checkOutTime: string;
  reason: string;
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * REGULARIZATION SERVICE – SINGLETON for punch-correction workflows
 * ────────────────────────────────────────────────────────────────────────────
 */
class RegularizationService {
  private static instance: RegularizationService | null = null;

  private constructor() {}

  public static getInstance(): RegularizationService {
    if (!RegularizationService.instance) {
      RegularizationService.instance = new RegularizationService();
    }
    return RegularizationService.instance;
  }

  public listMine(userId: string): Promise<RegularizationDocument[]> {
    return regularizationRepository.queries.listMine(userId);
  }

  public listAll(status?: string): Promise<RegularizationDocument[]> {
    return regularizationRepository.queries.listAll(status);
  }

  public async request(input: RegularizationInputShape, actorId: string): Promise<RegularizationDocument> {
    // ── Guards: no future dates, no duplicate request for the same day ──
    const regDay = dayjs(input.date).startOf('day');
    if (!regDay.isValid() || regDay.isAfter(dayjs().endOf('day'))) {
      throw new ValidationError('Regularization cannot be requested for a future date.');
    }
    const duplicate = await regularizationRepository.queries.findDuplicateForDay(actorId, input.date);
    if (duplicate) {
      throw new ValidationError(
        `A regularization request already exists for ${dayjs(input.date).format('MMM D')}.`,
      );
    }

    const reg = await regularizationRepository.queries.create({
      user: actorId as never,
      date: input.date,
      checkInTime: input.checkInTime,
      checkOutTime: input.checkOutTime,
      reason: input.reason,
      status: 'PENDING',
    });
    await reg.populate('user');
    pubsub.publish(PUBSUB_CHANNELS.REGULARIZATION_ADDED, { regularizationAdded: reg });

    const staffName = (reg.user as unknown as { name: string }).name;
    await notificationService.notifyAdmins({
      type: 'REGULARIZATION_REQUEST',
      title: 'Punch regularization requested',
      message: `${staffName} requested regularization for ${d(reg.date).format('MMM D')} (${reg.checkInTime} – ${reg.checkOutTime}).`,
      link: `/approvals?focus=${reg._id}#attendance`,
      pill: { label: 'PUNCH CORRECTION', tone: 'info' },
      rows: [
        ['Employee', staffName],
        ['Date', d(reg.date).format('MMM D, YYYY')],
        ['Requested Check In', reg.checkInTime],
        ['Requested Check Out', reg.checkOutTime],
        ...(reg.reason ? [['Reason', reg.reason]] : []),
      ] as Array<[string, string]>,
      noteText: 'Please review and approve or reject this punch correction.',
      meta: { regularizationId: String(reg._id) },
      excludeUserId: actorId,
    });

    return reg;
  }

  public async review(
    id: string,
    status: string,
    adminFeedback: string | null | undefined,
    approverId: string,
  ): Promise<RegularizationDocument> {
    const reg = await regularizationRepository.queries.findByIdPopulatedUser(id);
    if (!reg) throw new ValidationError('Regularization request not found');

    const populated = await this.applyDecision({ reg, status, adminFeedback, approverId });

    // Self-review guard – the reviewer never gets notified/emailed about
    // their own regularization request.
    const requesterId = String((reg.user as unknown as { _id: unknown })._id);
    const isSelfReview = requesterId === String(approverId);

    if (!isSelfReview) {
      await notificationService.push({
        recipientIds: [requesterId],
        type: 'REGULARIZATION_DECISION',
        title: status === 'APPROVED' ? 'Attendance regularized' : 'Regularization rejected',
        message: `${d(reg.date).format('MMM D')}${adminFeedback ? ` · ${adminFeedback}` : ''}`,
        link: '/history',
        meta: { regularizationId: String(reg._id) },
      });

      void mailService
        .sendRegularizationDecisionEmail(reg.user as never, {
          status,
          date: d(reg.date).format('MMM D, YYYY'),
          checkInTime: reg.checkInTime,
          checkOutTime: reg.checkOutTime,
          feedback: adminFeedback,
        })
        .catch((e) => logger.error(e));
    }

    return populated;
  }

  /**
   * DECISION PIPELINE – shared by manual review AND the auto-approve sweep so
   * both paths produce identical attendance records & inbox clean-up.
   */
  private async applyDecision(args: {
    reg: RegularizationDocument;
    status: string;
    adminFeedback?: string | null;
    approverId: string | null;
  }): Promise<RegularizationDocument> {
    const { reg, status, adminFeedback, approverId } = args;

    reg.status = status as RegularizationDocument['status'];
    reg.adminFeedback = adminFeedback ?? undefined;
    reg.approvedBy = (approverId || null) as never;
    await reg.save();

    // If approved, automatically regularize punch records in Attendance.
    if (status === 'APPROVED') {
      const date = reg.date;
      const checkInDateTime = dayjs(`${date} ${reg.checkInTime}`).toDate();
      const checkOutDateTime = dayjs(`${date} ${reg.checkOutTime}`).toDate();
      const userId = String((reg.user as unknown as { _id: unknown })._id);

      const buildPunch = () => ({
        selfieUrl: '/uploads/regularized.png',
        location: {
          latitude: 28.6139,
          longitude: 77.209,
          withinGeofence: true,
          distanceFromOffice: 0,
          address: 'Regularized Attendance',
          branchName: 'Regularized Attendance',
          isCoverDuty: false,
        },
        approvalStatus: 'APPROVED' as const,
        adminComments: adminFeedback || 'Regularized by Admin',
      });

      // 1. Clock In record
      let clockIn = await attendanceRepository.queries.findByUserDateType(userId, date, 'CLOCK_IN');
      if (!clockIn) {
        clockIn = await attendanceRepository.queries.create({
          ...buildPunch(),
          user: userId as never,
          date,
          type: 'CLOCK_IN',
        });
      } else {
        clockIn.createdAt = checkInDateTime;
        clockIn.approvalStatus = 'APPROVED';
        clockIn.adminComments = adminFeedback ?? undefined;
      }
      await clockIn.save();

      // 2. Clock Out record
      let clockOut = await attendanceRepository.queries.findByUserDateType(userId, date, 'CLOCK_OUT');
      if (!clockOut) {
        clockOut = await attendanceRepository.queries.create({
          ...buildPunch(),
          user: userId as never,
          date,
          type: 'CLOCK_OUT',
        });
      } else {
        clockOut.createdAt = checkOutDateTime;
        clockOut.approvalStatus = 'APPROVED';
        clockOut.adminComments = adminFeedback ?? undefined;
      }
      await clockOut.save();
    }

    const populated = (await reg.populate(['user', 'approvedBy'])) as RegularizationDocument;
    pubsub.publish(PUBSUB_CHANNELS.REGULARIZATION_UPDATED, { regularizationUpdated: populated });

    // Close the original request notification in every admin's inbox.
    await notificationRepository.queries.closeMetaNotifications(
      'REGULARIZATION_REQUEST',
      'regularizationId',
      String(reg._id),
    );

    return populated;
  }

  /**
   * Auto-approve sweep – resolves PENDING regularizations nobody reviewed.
   * Only active when Settings.regularizationAutoApproveDays >= 1.
   */
  public async autoResolveStale(): Promise<number> {
    try {
      const settings = await settingsRepository.queries.findFirstLean();
      const days = settings?.regularizationAutoApproveDays || 0;
      if (days < 1) return 0;

      const cutoff = dayjs().subtract(days, 'day').toDate();
      const stale = await regularizationRepository.queries.listStalePending(cutoff);

      let resolved = 0;
      for (const reg of stale) {
        // eslint-disable-next-line no-await-in-loop
        const populated = await this.applyDecision({
          reg,
          status: 'APPROVED',
          adminFeedback: `Auto-approved – pending for more than ${days} day(s) without review.`,
          approverId: null,
        });
        resolved += 1;

        const staffId = String((populated.user as unknown as { _id: unknown })._id);
        // eslint-disable-next-line no-await-in-loop
        await notificationService.push({
          recipientIds: [staffId],
          type: 'REGULARIZATION_DECISION',
          title: 'Attendance regularized (auto-approved)',
          message: `${d(populated.date).format('MMM D')} · auto-approved after ${days} day(s)`,
          link: '/history',
          meta: { regularizationId: String(populated._id) },
        });

        void mailService
          .sendRegularizationDecisionEmail(populated.user as never, {
            status: 'APPROVED',
            date: d(populated.date).format('MMM D, YYYY'),
            checkInTime: populated.checkInTime,
            checkOutTime: populated.checkOutTime,
            feedback: 'Auto-approved by the system.',
          })
          .catch((e) => logger.error(e));
      }

      if (resolved > 0) logger.info(`Auto-approved ${resolved} stale regularization request(s)`);
      return resolved;
    } catch (error) {
      logger.error('Regularization auto-approve sweep failed', error);
      return 0;
    }
  }
}

export const regularizationService = RegularizationService.getInstance();
