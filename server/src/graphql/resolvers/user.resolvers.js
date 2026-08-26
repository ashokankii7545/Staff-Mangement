import mongoose from 'mongoose';
import dayjs from 'dayjs';
import User from '../../models/User.js';
import Exemption from '../../models/Exemption.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { ValidationError } from '../../utils/errors.js';
import { pushNotification } from '../../services/notification.service.js';
import { sendUserApprovalEmail, sendProfileUpdateEmail, sendBroadcastEmail, sendAccountStatusEmail, sendTemporaryDutyEmail, sendDayOffEmail } from '../../services/mail.service.js';

export default {
  Query: {
    me: async (_, __, { user }) => {
      requireAuth(user);
      return User.findById(user._id);
    },
    
    users: async (_, { isActive }, { user }) => {
      requireAdmin(user);
      const query = {};
            if (isActive !== undefined) query.isActive = isActive;
      return User.find(query).populate('assignedOffice').sort({ name: 1 });
    },
    
    user: async (_, { id }, { user }) => {
      requireAdmin(user);
      return User.findById(id).populate('assignedOffice');
    },

    /** Self-signups waiting for an admin decision */
    pendingUsers: async (_, __, { user }) => {
      requireAdmin(user);
      return User.find({ approvalStatus: 'PENDING', role: 'STAFF' })
        .populate('assignedOffice')
        .sort({ createdAt: 1 });
    },

    /** Day-off exemptions in a date range (admin) */
    exemptions: async (_, { startDate, endDate }, { user }) => {
      requireAdmin(user);
      const query = {};
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = startDate;
        if (endDate) query.date.$lte = endDate;
      }
      return Exemption.find(query)
        .populate('user')
        .populate('createdBy')
        .sort({ date: -1 })
        .limit(500);
    },
  },
  
  Mutation: {
    updateUser: async (_, { id, input }, { user }) => {
      requireAdmin(user);
      const updateData = { ...input };
      if (updateData.officeId) {
        updateData.assignedOffice = updateData.officeId;
        delete updateData.officeId;
      }
      const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true }).populate('assignedOffice');
      if (updatedUser) sendProfileUpdateEmail(updatedUser).catch(console.error);
      return updatedUser;
    },
    
    toggleUserActive: async (_, { userId }, { user }) => {
      requireAdmin(user);
      const targetUser = await User.findById(userId).populate('assignedOffice');
      if (!targetUser) throw new Error('User not found');
      // Guard-rails: ADMIN accounts can never be deactivated (prevents a full
      // admin lock-out) and you cannot deactivate your own account.
      if (targetUser.role === 'ADMIN') {
        throw new Error('Admin accounts cannot be deactivated.');
      }
      if (String(targetUser._id) === String(user._id)) {
        throw new Error('You cannot deactivate your own account.');
      }
      targetUser.isActive = !targetUser.isActive;
      await targetUser.save();
      // Tell the staff member their account state changed
      sendAccountStatusEmail(targetUser, { isActive: targetUser.isActive }).catch(console.error);
      return targetUser;
    },

    /** Persist the UI theme so it follows the user across devices & re-logins */
    setThemePreference: async (_, { mode }, { user }) => {
      requireAuth(user);
      if (!['light', 'dark', 'system'].includes(mode)) {
        throw ValidationError(`Invalid theme "${mode}".`);
      }
      return User.findByIdAndUpdate(user._id, { themePreference: mode }, { new: true });
    },

    /**
     * TEMPORARY duty reassignment – staff can punch at another site between
     * dates WITHOUT touching their permanent assignment.
     */
    assignTemporaryDuty: async (_, { userId, officeId, startDate, endDate, reason }, { user }) => {
      requireAdmin(user);

      const office = await mongoose.model('Office').findById(officeId);
      if (!office) throw ValidationError('Office not found.');

      const start = dayjs(startDate).startOf('day');
      const end = dayjs(endDate).endOf('day');
      if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
        throw ValidationError('Invalid temporary-duty date range.');
      }

      const target = await User.findById(userId);
      if (!target) throw ValidationError('User not found.');

      target.temporaryAssignment = {
        office: office._id,
        startDate: start.toDate(),
        endDate: end.toDate(),
        reason: reason || '',
      };
      await target.save();

      await pushNotification({
        recipientIds: [target._id],
        type: 'TEMP_DUTY',
        title: `Temporary duty assigned: ${office.name}`,
        message: `${start.format('MMM D')} – ${end.format('MMM D')}${reason ? ` · ${reason}` : ''}. Your attendance will be marked at this site.`,
        link: '/attendance',
      });

      // Mirror over email
      sendTemporaryDutyEmail(target, {
        officeName: office.name,
        startDate: start.format('MMM D, YYYY'),
        endDate: end.format('MMM D, YYYY'),
        reason,
      }).catch(console.error);

      await target.populate(['assignedOffice', 'temporaryAssignment.office']);
      return target;
    },

    clearTemporaryDuty: async (_, { userId }, { user }) => {
      requireAdmin(user);
      const previous = await User.findById(userId).populate('temporaryAssignment.office');
      if (!previous) throw ValidationError('User not found.');

      const clearedOfficeName = previous.temporaryAssignment?.office?.name || 'the site';

      const target = await User.findByIdAndUpdate(
        userId,
        { $set: { temporaryAssignment: { office: null, startDate: null, endDate: null, reason: '' } } },
        { new: true }
      ).populate(['assignedOffice', 'temporaryAssignment.office']);

      // Mirror over email
      sendTemporaryDutyEmail(target, { officeName: clearedOfficeName, cleared: true }).catch(console.error);
      return target;
    },

    /** Grant a staff member a day off on a specific date (excluded from absence stats) */
    grantDayOff: async (_, { userId, date, reason }, { user }) => {
      requireAdmin(user);
      const cleanDate = dayjs(date).format('YYYY-MM-DD');

      let exemption = await Exemption.findOneAndUpdate(
        { user: userId, date: cleanDate },
        { reason: reason || '', createdBy: user._id },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      exemption = await exemption.populate(['user', 'createdBy']);

      await pushNotification({
        recipientIds: [userId],
        type: 'DAY_OFF',
        title: `Day off granted: ${dayjs(cleanDate).format('ddd, MMM D')}`,
        message: reason || 'You are not required to mark attendance on this day.',
        link: '/attendance',
      });

      // Mirror over email
      sendDayOffEmail(exemption.user, { date: dayjs(cleanDate).format('MMM D, YYYY'), reason }).catch(console.error);

      return exemption;
    },

    
    broadcastEmail: async (_, { subject, message }, { user }) => {
      requireAdmin(user);
      await sendBroadcastEmail(subject, message);
      return true;
    },
  revokeDayOff: async (_, { id }, { user }) => {
      requireAdmin(user);
      // Fetch before delete so we can still tell the staff member what was revoked
      const exemption = await Exemption.findById(id).populate('user');
      const res = await Exemption.findByIdAndDelete(id);
      if (res && exemption?.user) {
        sendDayOffEmail(exemption.user, { date: dayjs(exemption.date).format('MMM D, YYYY'), revoked: true }).catch(console.error);
      }
      return !!res;
    },
  },
  
  User: {
    id: (parent) => parent._id || parent.id,
    assignedOffice: async (parent) => {
      if (parent.assignedOffice && parent.assignedOffice._id) {
        return parent.assignedOffice; // already populated
      }
      if (parent.assignedOffice) {
        // Just the ID
        return await mongoose.model('Office').findById(parent.assignedOffice);
      }
      return null;
    },
    temporaryAssignment: async (parent) => {
      const ta = parent.temporaryAssignment;
      if (!ta || !ta.office) return null;
      if (ta.office && ta.office._id) return ta; // already populated
      const office = await mongoose.model('Office').findById(ta.office);
      return office ? ta : null;
    },
    leaveBalances: (parent) => {
      // Return exactly what is in DB to prevent calculation confusion.
      // If user document is old and missing leaveBalances, default them correctly.
      if (!parent.leaveBalances) {
        return { casual: 12, sick: 6, earned: 0 };
      }
      
      return {
        casual: parent.leaveBalances.casual ?? 12,
        sick: parent.leaveBalances.sick ?? 6,
        earned: parent.leaveBalances.earned ?? 0
      };
    }
  },
};

