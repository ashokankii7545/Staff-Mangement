import dayjs from 'dayjs';
import { processAttendance, getAttendanceSummary, getDashboardStats, getMonthlyTrend } from '../../services/attendance.service.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import Attendance from '../../models/Attendance.js';
import Notification from '../../models/Notification.js';
import { pushNotification } from '../../services/notification.service.js';
import { sendAttendanceReviewEmail } from '../../services/mail.service.js';

export default {
  Query: {
    myAttendance: async (_, { startDate, endDate }, { user }) => {
      requireAuth(user);
      const start = startDate || dayjs().startOf('month').format('YYYY-MM-DD');
      const end = endDate || dayjs().format('YYYY-MM-DD');
      return getAttendanceSummary({ userId: user._id, startDate: start, endDate: end });
    },
    
    allAttendance: async (_, { startDate, endDate, userId }, { user }) => {
      requireAdmin(user);
      const start = startDate || dayjs().startOf('month').format('YYYY-MM-DD');
      const end = endDate || dayjs().format('YYYY-MM-DD');
      return getAttendanceSummary({ userId, startDate: start, endDate: end, allUsers: !userId });
    },
    
    dashboardStats: async (_, __, { user }) => {
      requireAuth(user);
      return getDashboardStats();
    },
    
    todayStatus: async (_, __, { user }) => {
      requireAuth(user);
      const today = dayjs().format('YYYY-MM-DD');
      const summaries = await getAttendanceSummary({ userId: user._id, startDate: today, endDate: today });
      return summaries[0] || null;
    },
    
    weeklyAttendance: async (_, __, { user }) => {
      requireAuth(user);
      const endDate = dayjs().format('YYYY-MM-DD');
      const startDate = dayjs().subtract(6, 'day').format('YYYY-MM-DD');
      return getAttendanceSummary({ userId: user._id, startDate, endDate });
    },
    
    monthlyTrend: async (_, { month, year }, { user }) => {
      requireAuth(user);
      return getMonthlyTrend(month, year);
    },
    
    recentActivity: async (_, { limit = 10 }, { user }) => {
      requireAuth(user);
      const query = user.role === 'ADMIN' ? {} : { user: user._id };
      return Attendance.find(query)
        .populate('user')
        .sort({ createdAt: -1 })
        .limit(limit);
    },
  },
  
  Mutation: {
    clockIn: async (_, { input }, { user, clientIp }) => {
      requireAuth(user);
      return processAttendance({ userId: user._id, type: 'CLOCK_IN', input, ipAddress: clientIp });
    },
    
    clockOut: async (_, { input }, { user, clientIp }) => {
      requireAuth(user);
      return processAttendance({ userId: user._id, type: 'CLOCK_OUT', input, ipAddress: clientIp });
    },
    
    reviewAttendance: async (_, { id, status, adminComments }, { user }) => {
      requireAdmin(user);
      const record = await Attendance.findById(id);
      if (!record) throw new Error('Attendance record not found');
      
      record.approvalStatus = status;
      record.approvedBy = user._id;
      if (adminComments !== undefined) record.adminComments = adminComments;
      
      await record.save();
      const populated = await record.populate('user');

      // Close the "Flagged punch needs review" notification in every admin's
      // inbox – reviewed punches must not keep showing up as unread.
      await Notification.updateMany(
        { type: 'ATTENDANCE_FLAGGED', 'meta.attendanceId': String(record._id) },
        { isRead: true }
      ).catch(() => {});

      // Self-review guard – reviewer never gets pinged about their own punch
      const isSelfReview = String(populated.user._id) === String(user._id);

      // Tell the staff member their flagged/regularized punch was reviewed
      if (!isSelfReview) {
        await pushNotification({
          recipientIds: [populated.user._id],
          type: 'ATTENDANCE_DECISION',
          title: status === 'APPROVED' ? 'Attendance approved' : 'Attendance rejected',
          message: `${dayjs(record.date).format('MMM D')} · ${record.type === 'CLOCK_IN' ? 'Clock-in' : 'Clock-out'}${adminComments ? ` · ${adminComments}` : ''}`,
          link: '/history',
          meta: { attendanceId: String(record._id) },
        });

        // Email the staff member about the review outcome
        sendAttendanceReviewEmail(populated.user, {
          status,
          date: dayjs(record.date).format('MMM D, YYYY'),
          punchType: record.type === 'CLOCK_IN' ? 'Clock-in' : 'Clock-out',
          comments: adminComments,
        }).catch(console.error);
      }

      return populated;
    }
  },
};
