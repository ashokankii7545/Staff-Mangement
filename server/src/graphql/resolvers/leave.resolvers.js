import Notification from '../../models/Notification.js';
import LeaveRequest from '../../models/LeaveRequest.js';
import User from '../../models/User.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { pubsub } from '../pubsub.js';
import { pushNotification, notifyAdmins } from '../../services/notification.service.js';
import dayjs from 'dayjs';
import { sendLeaveDecisionEmail } from '../../services/mail.service.js';

export default {
  Subscription: {
    leaveRequestAdded: {
      subscribe: () => pubsub.asyncIterableIterator(['LEAVE_REQUEST_ADDED'])
    },
    leaveRequestUpdated: {
      subscribe: () => pubsub.asyncIterableIterator(['LEAVE_REQUEST_UPDATED'])
    }
  },
  Query: {
    myLeaveRequests: async (_, __, { user }) => {
      requireAuth(user);
      return LeaveRequest.find({ user: user._id }).sort({ createdAt: -1 }).populate('user').populate('approvedBy');
    },
    
    allLeaveRequests: async (_, { status }, { user }) => {
      requireAdmin(user);
      const query = {};
      if (status) query.status = status;
      return LeaveRequest.find(query).sort({ createdAt: -1 }).populate('user').populate('approvedBy');
    },

    pendingApprovalsCount: async (_, __, { user }) => {
      requireAdmin(user);
      const leaveCount = await LeaveRequest.countDocuments({ status: 'PENDING' });
      // In a real scenario, we'd also add Attendance 'PENDING' count here if needed
      return leaveCount;
    }
  },
  
  Mutation: {
    applyForLeave: async (_, { input }, { user }) => {
      requireAuth(user);
      const targetUserId = (user.role === 'ADMIN' && input.userId) ? input.userId : user._id;

      // ── Date sanity guards ──
      const start = dayjs(input.startDate).startOf('day');
      const end = dayjs(input.endDate).startOf('day');
      if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
        throw new Error('Invalid leave dates – the end date cannot be before the start date.');
      }
      if (start.isBefore(dayjs().startOf('day'))) {
        throw new Error('Leave cannot be applied for a past date.');
      }

      // ── Overlap guard – PENDING or APPROVED leaves block double-booking ──
      const overlapping = await LeaveRequest.findOne({
        user: targetUserId,
        status: { $in: ['PENDING', 'APPROVED'] },
        startDate: { $lte: input.endDate },
        endDate: { $gte: input.startDate },
      });
      if (overlapping) {
        throw new Error('A pending or approved leave already covers these dates.');
      }

      // ── Balance guard – a request can never exceed the available balance ──
      // (Admins top-up the balance from Staff Management for exceptional cases.)
      const days = end.diff(start, 'day') + 1;
      const typeKey = String(input.leaveType || '').toLowerCase();
      const staffDoc = await User.findById(targetUserId).select('name leaveBalances');
      const available = Number(staffDoc?.leaveBalances?.[typeKey]) || 0;
      if (days > available) {
        throw new Error(
          `${staffDoc?.name || 'This staff member'} has only ${available} ${typeKey} leave day(s) left, but ${days} day(s) were requested. Increase the balance from Staff Management if this is intentional.`
        );
      }

      const leaveRequest = new LeaveRequest({
        leaveType: input.leaveType,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason,
        user: targetUserId,
        status: 'PENDING'
      });
      await leaveRequest.save();
      const populated = await leaveRequest.populate('user');
      pubsub.publish('LEAVE_REQUEST_ADDED', { leaveRequestAdded: populated });

      // Notify every admin so the request surfaces in their inbox instantly.
      // excludeUserId: the ACTOR never gets pinged about their own submission.
      await notifyAdmins({
        type: 'LEAVE_REQUEST',
        title: 'New leave request',
        message: `${populated.user.name} applied for ${leaveRequest.leaveType} leave (${dayjs(leaveRequest.startDate).format('MMM D')} – ${dayjs(leaveRequest.endDate).format('MMM D')}).`,
        link: `/approvals?focus=${leaveRequest._id}#leaves`,
        pill: { label: 'LEAVE REQUEST', tone: 'warning' },
        rows: [
          ['Employee', populated.user.name],
          ['Leave Type', leaveRequest.leaveType],
          ['Start Date', dayjs(leaveRequest.startDate).format('MMM D, YYYY')],
          ['End Date', dayjs(leaveRequest.endDate).format('MMM D, YYYY')],
          ...(leaveRequest.reason ? [['Reason', leaveRequest.reason]] : []),
        ],
        noteText: 'Please review and approve or reject this leave request.',
        meta: { leaveRequestId: String(leaveRequest._id) },
        excludeUserId: user._id,
      });

      return populated;
    },
    
    /** Staff withdraws their OWN pending/approved leave – admin is always informed */
    cancelMyLeave: async (_, { id }, { user }) => {
      requireAuth(user);
      const leaveRequest = await LeaveRequest.findById(id).populate('user');
      if (!leaveRequest) throw new Error('Leave request not found');
      if (String(leaveRequest.user._id) !== String(user._id)) {
        throw new Error('You can only cancel your own leave requests.');
      }
      if (!['PENDING', 'APPROVED'].includes(leaveRequest.status)) {
        throw new Error('Only pending or approved leaves can be cancelled.');
      }

      const wasApproved = leaveRequest.status === 'APPROVED';
      // Approved leaves already deducted the balance – refund it on cancellation
      if (wasApproved) {
        try {
          const typeKey = leaveRequest.leaveType.toLowerCase();
          const days = Math.round((new Date(leaveRequest.endDate) - new Date(leaveRequest.startDate)) / (1000 * 60 * 60 * 24)) + 1;
          const staffDoc = await User.findById(leaveRequest.user._id).select('leaveBalances');
          const current = Number(staffDoc?.leaveBalances?.[typeKey]) || 0;
          await User.findByIdAndUpdate(leaveRequest.user._id, {
            $set: { [`leaveBalances.${typeKey}`]: current + days },
          });
        } catch (balanceErr) {
          console.error('⚠️ Leave balance refund failed – cancellation STILL applied:', balanceErr.message);
        }
      }

      leaveRequest.status = 'CANCELLED';
      await leaveRequest.save();
      const populated = await leaveRequest.populate('user');
      pubsub.publish('LEAVE_REQUEST_UPDATED', { leaveRequestUpdated: populated });

      // Admin is ALWAYS informed – the cancellation lands in their inbox
      await notifyAdmins({
        type: 'LEAVE_REQUEST',
        title: wasApproved ? 'Approved leave cancelled' : 'Leave request withdrawn',
        message: `${populated.user.name} cancelled their ${leaveRequest.leaveType} leave (${dayjs(leaveRequest.startDate).format('MMM D')} – ${dayjs(leaveRequest.endDate).format('MMM D')})${wasApproved ? ' – balance refunded.' : '.'}`,
        link: '/history',
        meta: { leaveRequestId: String(leaveRequest._id) },
      });

      // Close the original "New leave request" admin notifications
      await Notification.updateMany(
        { type: 'LEAVE_REQUEST', 'meta.leaveRequestId': String(leaveRequest._id) },
        { isRead: true }
      ).catch(() => {});

      return populated;
    },

    reviewLeaveRequest: async (_, { id, status, adminFeedback }, { user }) => {
      requireAdmin(user);
      
      const leaveRequest = await LeaveRequest.findById(id).populate('user');
      if (!leaveRequest) throw new Error('Leave request not found');
      
      if (leaveRequest.status !== 'PENDING') {
        throw new Error('Leave request is already processed');
      }

      leaveRequest.status = status;
      leaveRequest.adminFeedback = adminFeedback;
      leaveRequest.approvedBy = user._id;
      
      // Deduct balance if approved. A bookkeeping failure must NEVER block the
      // admin's decision – log it loudly and still apply the approval.
      if (status === 'APPROVED') {
        try {
          const typeKey = leaveRequest.leaveType.toLowerCase();
          const days = Math.round((new Date(leaveRequest.endDate) - new Date(leaveRequest.startDate)) / (1000 * 60 * 60 * 24)) + 1;
          // Read-modify-write floored at zero – balances can never go negative
          const staffDoc = await User.findById(leaveRequest.user._id).select('leaveBalances');
          const current = Number(staffDoc?.leaveBalances?.[typeKey]) || 0;
          await User.findByIdAndUpdate(leaveRequest.user._id, {
            $set: { [`leaveBalances.${typeKey}`]: Math.max(0, current - days) },
          });
        } catch (balanceErr) {
          console.error('⚠️ Leave balance deduction failed – approval STILL applied:', balanceErr.message);
        }
      }
      
      await leaveRequest.save();
      const populated = await leaveRequest.populate('approvedBy');
      pubsub.publish('LEAVE_REQUEST_UPDATED', { leaveRequestUpdated: populated });

      // The original "New leave request" notification has served its purpose –
      // close it in EVERY admin's inbox so processed items stop reappearing.
      await Notification.updateMany(
        { type: 'LEAVE_REQUEST', 'meta.leaveRequestId': String(leaveRequest._id) },
        { isRead: true }
      ).catch(() => {});

      // Never ping / email the reviewer about their OWN request
      // (admin testing with their own account – self-review case).
      const isSelfReview = String(leaveRequest.user._id) === String(user._id);

      // Close the loop – tell the requester what was decided
      if (!isSelfReview) {
        await pushNotification({
          recipientIds: [leaveRequest.user._id],
          type: 'LEAVE_DECISION',
          title: status === 'APPROVED' ? 'Leave approved' : 'Leave rejected',
          message: `${dayjs(leaveRequest.startDate).format('MMM D')} – ${dayjs(leaveRequest.endDate).format('MMM D')}${adminFeedback ? ` · ${adminFeedback}` : ''}`,
          link: '/leaves',
          meta: { leaveRequestId: String(leaveRequest._id) },
        });

        // Mirror the decision over email so it reaches the requester even offline
        sendLeaveDecisionEmail(leaveRequest.user, {
          status,
          leaveType: leaveRequest.leaveType,
          startDate: dayjs(leaveRequest.startDate).format('MMM D, YYYY'),
          endDate: dayjs(leaveRequest.endDate).format('MMM D, YYYY'),
          feedback: adminFeedback,
          reviewerName: populated.approvedBy?.name,
        }).catch(console.error);
      }

      return populated;
    },
  },
  
  LeaveRequest: {
    id: (parent) => parent._id || parent.id
  }
};
