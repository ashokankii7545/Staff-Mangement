import dayjs from 'dayjs';
import Attendance from '../models/Attendance.js';
import Settings from '../models/Settings.js';
import Notification from '../models/Notification.js';
import { pushNotification } from './notification.service.js';

/**
 * PUNCH REMINDERS – gentle nudges so pending punches don't pile up for the
 * owner to chase manually:
 *   - CLOCK_IN : shift started + 30 min and the staff member still hasn't punched in
 *   - CLOCK_OUT: shift ended + 30 min and they clocked in but never out
 * Each reminder fires AT MOST ONCE per staff member per day (meta key guard),
 * so the 15-minute sweep can never spam anyone.
 */
export const checkPunchReminders = async () => {
  try {
    const settings = await Settings.findOne();
    const shiftStart = settings?.shiftStartTime || '09:00';
    const shiftEnd = settings?.shiftEndTime || '18:00';
    const today = dayjs().format('YYYY-MM-DD');
    const now = dayjs();

    const inDeadline = dayjs(`${today}T${shiftStart}`).add(30, 'minute');
    const outDeadline = dayjs(`${today}T${shiftEnd}`).add(30, 'minute');
    if (!inDeadline.isValid() || !outDeadline.isValid()) return;

    const { default: User } = await import('../models/User.js');
    const staff = await User.find({ role: 'STAFF', isActive: true, approvalStatus: 'APPROVED' }).select('_id name');
    if (!staff.length) return;

    const punchIns = await Attendance.find({ date: today, type: 'CLOCK_IN' }).select('user');
    const punchOuts = await Attendance.find({ date: today, type: 'CLOCK_OUT' }).select('user');
    const inSet = new Set(punchIns.map((p) => String(p.user)));
    const outSet = new Set(punchOuts.map((p) => String(p.user)));

    const sendOnce = async (staffId, kind, title, message) => {
      const reminderKey = `${staffId}_${today}_${kind}`;
      const already = await Notification.findOne({ type: 'PUNCH_REMINDER', 'meta.reminderKey': reminderKey }).lean();
      if (already) return;
      await pushNotification({
        recipientIds: [staffId],
        type: 'PUNCH_REMINDER',
        title,
        message,
        link: '/attendance',
        meta: { reminderKey, date: today, kind },
      });
    };

    for (const s of staff) {
      const id = String(s._id);
      if (now.isAfter(inDeadline) && now.isBefore(outDeadline) && !inSet.has(id)) {
        await sendOnce(id, 'CLOCK_IN', 'Clock-in reminder', 'You have not marked your clock-in today. Open Mark Attendance and punch in with a selfie.');
      }
      if (now.isAfter(outDeadline) && inSet.has(id) && !outSet.has(id)) {
        await sendOnce(id, 'CLOCK_OUT', 'Clock-out reminder', 'Your shift has ended but no clock-out was recorded. Please clock out to close your shift.');
      }
    }
  } catch (err) {
    console.error('Punch reminder sweep failed:', err.message);
  }
};

/** Boot scheduler: first sweep 2 minutes after start, then every 15 minutes */
export const startPunchReminderScheduler = () => {
  setTimeout(() => { checkPunchReminders(); }, 2 * 60 * 1000);
  setInterval(() => { checkPunchReminders(); }, 15 * 60 * 1000);
};