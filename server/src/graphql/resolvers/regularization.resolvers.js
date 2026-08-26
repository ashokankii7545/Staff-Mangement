import Notification from '../../models/Notification.js';
import Regularization from '../../models/Regularization.js';
import Attendance from '../../models/Attendance.js';
import Settings from '../../models/Settings.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { pubsub } from '../pubsub.js';
import { pushNotification, notifyAdmins } from '../../services/notification.service.js';
import dayjs from 'dayjs';
import { sendRegularizationDecisionEmail } from '../../services/mail.service.js';

// ────────────────────────────────────────────────────────────────────────────
// DECISION PIPELINE – shared by manual review AND the auto-approve sweep so
// both paths produce identical attendance records & inbox clean-up.
// ────────────────────────────────────────────────────────────────────────────
const applyRegularizationDecision = async ({ reg, status, adminFeedback, approverId }) => {
  reg.status = status;
  reg.adminFeedback = adminFeedback;
  reg.approvedBy = approverId || null;
  await reg.save();

  // If approved, automatically regularize punch records in Attendance
  if (status === 'APPROVED') {
    const date = reg.date;
    const checkInDateTime = dayjs(`${date} ${reg.checkInTime}`).toDate();
    const checkOutDateTime = dayjs(`${date} ${reg.checkOutTime}`).toDate();

    // 1. Clock In record
    let clockIn = await Attendance.findOne({ user: reg.user._id, date, type: 'CLOCK_IN' });
    if (!clockIn) {
      clockIn = new Attendance({
        user: reg.user._id,
        date,
        type: 'CLOCK_IN',
        selfieUrl: '/uploads/regularized.png',
        location: {
          latitude: 28.6139,
          longitude: 77.2090,
          withinGeofence: true,
          distanceFromOffice: 0,
          address: 'Regularized Attendance',
        },
        approvalStatus: 'APPROVED',
        adminComments: adminFeedback || 'Regularized by Admin',
        createdAt: checkInDateTime,
      });
    } else {
      clockIn.createdAt = checkInDateTime;
      clockIn.approvalStatus = 'APPROVED';
      clockIn.adminComments = adminFeedback;
    }
    await clockIn.save();

    // 2. Clock Out record
    let clockOut = await Attendance.findOne({ user: reg.user._id, date, type: 'CLOCK_OUT' });
    if (!clockOut) {
      clockOut = new Attendance({
        user: reg.user._id,
        date,
        type: 'CLOCK_OUT',
        selfieUrl: '/uploads/regularized.png',
        location: {
          latitude: 28.6139,
          longitude: 77.2090,
          withinGeofence: true,
          distanceFromOffice: 0,
          address: 'Regularized Attendance',
        },
        approvalStatus: 'APPROVED',
        adminComments: adminFeedback || 'Regularized by Admin',
        createdAt: checkOutDateTime,
      });
    } else {
      clockOut.createdAt = checkOutDateTime;
      clockOut.approvalStatus = 'APPROVED';
      clockOut.adminComments = adminFeedback;
    }
    await clockOut.save();
  }

  const populated = await reg.populate(['user', 'approvedBy']);
  pubsub.publish('REGULARIZATION_UPDATED', { regularizationUpdated: populated });

  // Close the original request notification in every admin's inbox –
  // processed requests must not keep showing up as unread.
  await Notification.updateMany(
    { type: 'REGULARIZATION_REQUEST', 'meta.regularizationId': String(reg._id) },
    { isRead: true }
  ).catch(() => {});

  return populated;
};

/**
 * Auto-approve sweep – resolves PENDING regularizations nobody reviewed.
 * Only active when Settings.regularizationAutoApproveDays >= 1.
 * @returns {Promise<number>} how many requests were resolved
 */
export const autoResolveStaleRegularizations = async () => {
  try {
    const settings = await Settings.findOne().select('regularizationAutoApproveDays').lean();
    const days = settings?.regularizationAutoApproveDays || 0;
    if (days < 1) return 0;

    const cutoff = dayjs().subtract(days, 'day').toDate();
    const stale = await Regularization.find({ status: 'PENDING', createdAt: { $lt: cutoff } })
      .populate('user');

    let resolved = 0;
    for (const reg of stale) {
      // eslint-disable-next-line no-await-in-loop
      const populated = await applyRegularizationDecision({
        reg,
        status: 'APPROVED',
        adminFeedback: `Auto-approved – pending for more than ${days} day(s) without review.`,
        approverId: null,
      });
      resolved += 1;

      // eslint-disable-next-line no-await-in-loop
      await pushNotification({
        recipientIds: [populated.user._id],
        type: 'REGULARIZATION_DECISION',
        title: 'Attendance regularized (auto-approved)',
        message: `${dayjs(populated.date).format('MMM D')} · auto-approved after ${days} day(s)`,
        link: '/history',
        meta: { regularizationId: String(populated._id) },
      });

      sendRegularizationDecisionEmail(populated.user, {
        status: 'APPROVED',
        date: dayjs(populated.date).format('MMM D, YYYY'),
        checkInTime: populated.checkInTime,
        checkOutTime: populated.checkOutTime,
        feedback: 'Auto-approved by the system.',
      }).catch(console.error);
    }

    if (resolved > 0) console.log(`🤖 Auto-approved ${resolved} stale regularization request(s)`);
    return resolved;
  } catch (err) {
    console.error('Regularization auto-approve sweep failed:', err.message);
    return 0;
  }
};

/** Boot-time scheduler: first sweep 30s after start, then once every 24h */
export const startRegularizationAutoApprover = () => {
  setTimeout(() => { autoResolveStaleRegularizations(); }, 30_000);
  setInterval(() => { autoResolveStaleRegularizations(); }, 24 * 60 * 60 * 1000);
};

export default {
  Subscription: {
    regularizationAdded: {
      subscribe: () => pubsub.asyncIterableIterator(['REGULARIZATION_ADDED']),
    },
    regularizationUpdated: {
      subscribe: () => pubsub.asyncIterableIterator(['REGULARIZATION_UPDATED']),
    },
  },
  Query: {
    myRegularizations: async (_, __, { user }) => {
      requireAuth(user);
      return Regularization.find({ user: user._id })
        .sort({ createdAt: -1 })
        .populate('user')
        .populate('approvedBy');
    },

    allRegularizations: async (_, { status }, { user }) => {
      requireAdmin(user);
      const query = {};
      if (status) query.status = status;
      return Regularization.find(query)
        .sort({ createdAt: -1 })
        .populate('user')
        .populate('approvedBy');
    },
  },

  Mutation: {
    requestRegularization: async (_, { input }, { user }) => {
      requireAuth(user);

      // ── Guards: no future dates, no duplicate request for the same day ──
      const regDay = dayjs(input.date).startOf('day');
      if (!regDay.isValid() || regDay.isAfter(dayjs().endOf('day'))) {
        throw new Error('Regularization cannot be requested for a future date.');
      }
      const duplicate = await Regularization.findOne({
        user: user._id,
        date: input.date,
        status: { $ne: 'REJECTED' },
      });
      if (duplicate) {
        throw new Error(`A regularization request already exists for ${dayjs(input.date).format('MMM D')}.`);
      }

      const reg = new Regularization({
        user: user._id,
        date: input.date,
        checkInTime: input.checkInTime,
        checkOutTime: input.checkOutTime,
        reason: input.reason,
        status: 'PENDING',
      });
      await reg.save();
      const populated = await reg.populate('user');
      pubsub.publish('REGULARIZATION_ADDED', { regularizationAdded: populated });

      await notifyAdmins({
        type: 'REGULARIZATION_REQUEST',
        title: 'Punch regularization requested',
        message: `${populated.user.name} requested regularization for ${dayjs(reg.date).format('MMM D')} (${reg.checkInTime} – ${reg.checkOutTime}).`,
        link: `/approvals?focus=${reg._id}#attendance`,
        pill: { label: 'PUNCH CORRECTION', tone: 'info' },
        rows: [
          ['Employee', populated.user.name],
          ['Date', dayjs(reg.date).format('MMM D, YYYY')],
          ['Requested Check In', reg.checkInTime],
          ['Requested Check Out', reg.checkOutTime],
          ...(reg.reason ? [['Reason', reg.reason]] : []),
        ],
        noteText: 'Please review and approve or reject this punch correction.',
        meta: { regularizationId: String(reg._id) },
        excludeUserId: user._id,
      });

      return populated;
    },

    reviewRegularization: async (_, { id, status, adminFeedback }, { user }) => {
      requireAdmin(user);
      const reg = await Regularization.findById(id).populate('user');
      if (!reg) throw new Error('Regularization request not found');

      const populated = await applyRegularizationDecision({
        reg,
        status,
        adminFeedback,
        approverId: user._id,
      });

      // Self-review guard – the reviewer never gets notified/emailed about
      // their own regularization request.
      const isSelfReview = String(reg.user._id) === String(user._id);

      if (!isSelfReview) {
        await pushNotification({
          recipientIds: [reg.user._id],
          type: 'REGULARIZATION_DECISION',
          title: status === 'APPROVED' ? 'Attendance regularized' : 'Regularization rejected',
          message: `${dayjs(reg.date).format('MMM D')}${adminFeedback ? ` · ${adminFeedback}` : ''}`,
          link: '/history',
          meta: { regularizationId: String(reg._id) },
        });

        // Email the decision to the requester
        sendRegularizationDecisionEmail(reg.user, {
          status,
          date: dayjs(reg.date).format('MMM D, YYYY'),
          checkInTime: reg.checkInTime,
          checkOutTime: reg.checkOutTime,
          feedback: adminFeedback,
        }).catch(console.error);
      }

      return populated;
    },
  },
};
