import { DEFAULTS } from '../config/constants.js';
import { logger } from '../shared/logger/logger.js';
import { todayISO } from '../shared/utils/date.util.js';
import dayjs from 'dayjs';
import { settingsRepository } from '../modules/settings/settings.repository.js';
import { userRepository } from '../modules/user/user.repository.js';
import { attendanceRepository } from '../modules/attendance/attendance.repository.js';
import { notificationRepository } from '../modules/notification/notification.repository.js';
import { notificationService } from '../modules/notification/notification.service.js';

/**
 * PUNCH REMINDERS – gentle nudges so pending punches don't pile up:
 *   CLOCK_IN : shift started + 30 min and still no punch-in
 *   CLOCK_OUT: shift ended + 30 min, clocked-in but never out
 * Each reminder fires AT MOST ONCE per staff member per day (meta key guard),
 * so the 15-minute sweep can never spam anyone.
 */
export const checkPunchReminders = async (): Promise<void> => {
  try {
    const settings = await settingsRepository.queries.findFirstLean();
    const shiftStart = settings?.shiftStartTime || DEFAULTS.SHIFT_START;
    const shiftEnd = settings?.shiftEndTime || DEFAULTS.SHIFT_END;
    const today = todayISO();
    const now = dayjs();

    const inDeadline = dayjs(`${today}T${shiftStart}`).add(30, 'minute');
    const outDeadline = dayjs(`${today}T${shiftEnd}`).add(30, 'minute');
    if (!inDeadline.isValid() || !outDeadline.isValid()) return;

    const staff = await userRepository.queries.listActiveStaff();
    if (!staff.length) return;

    const [punchIns, punchOuts] = await Promise.all([
      attendanceRepository.queries.listClockInsByDateSelectUser(today),
      attendanceRepository.queries.listClockOutsByDateSelectUser(today),
    ]);
    const inSet = new Set(punchIns.map((p) => String(p.user)));
    const outSet = new Set(punchOuts.map((p) => String(p.user)));

    const sendOnce = async (
      staffId: string,
      kind: string,
      title: string,
      message: string,
    ): Promise<void> => {
      const reminderKey = `${staffId}_${today}_${kind}`;
      const already = await notificationRepository.queries.findReminderByKey(reminderKey);
      if (already) return;
      await notificationService.push({
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
        // eslint-disable-next-line no-await-in-loop
        await sendOnce(
          id,
          'CLOCK_IN',
          'Clock-in reminder',
          'You have not marked your clock-in today. Open Mark Attendance and punch in with a selfie.',
        );
      }
      if (now.isAfter(outDeadline) && inSet.has(id) && !outSet.has(id)) {
        // eslint-disable-next-line no-await-in-loop
        await sendOnce(
          id,
          'CLOCK_OUT',
          'Clock-out reminder',
          'Your shift has ended but no clock-out was recorded. Please clock out to close your shift.',
        );
      }
    }
  } catch (error) {
    logger.error('Punch reminder sweep failed', error);
  }
};

/** Boot scheduler: first sweep 2 minutes after start, then every 15 minutes */
export const startPunchReminderScheduler = (): void => {
  setTimeout(() => void checkPunchReminders(), 2 * 60 * 1000);
  setInterval(() => void checkPunchReminders(), 15 * 60 * 1000);
};
