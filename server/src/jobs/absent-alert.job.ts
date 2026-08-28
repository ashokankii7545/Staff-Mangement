import dayjs from 'dayjs';
import { DEFAULTS } from '../config/constants.js';
import { logger } from '../shared/logger/logger.js';
import { todayISO } from '../shared/utils/date.util.js';
import { settingsRepository } from '../modules/settings/settings.repository.js';
import { userRepository } from '../modules/user/user.repository.js';
import { attendanceRepository } from '../modules/attendance/attendance.repository.js';
import { leaveRepository } from '../modules/leave/leave.repository.js';
import { dayOffRepository } from '../modules/day-off/day-off.repository.js';
import { notificationRepository } from '../modules/notification/notification.repository.js';
import { notificationService } from '../modules/notification/notification.service.js';
import type { TemplateRow } from '../shared/mail/email-template.js';

/**
 * ABSENT ALERT – "kaun aaya hi nahi" 🚨
 * Every 10 minutes (after the alert deadline) the sweep computes which active
 * staff have NO clock-in today and are NOT excused (approved leave / day-off
 * exemption / non-working day). The FIRST sweep past the deadline sends ONE
 * daily digest to all admins – in-app inbox + branded email with the roster.
 * De-dupe guard: meta.guardKey = absent_alert_<date> (fires at most once/day).
 */
export const checkAbsentStaff = async (): Promise<void> => {
  try {
    const settings = await settingsRepository.queries.findFirstLean();
    const shiftStart = settings?.shiftStartTime || DEFAULTS.SHIFT_START;
    const today = todayISO();
    const now = dayjs();

    // Alert deadline: shift start + configured offset (09:00 shift → 10:30).
    const deadline = dayjs(`${today}T${shiftStart}`).add(
      DEFAULTS.ABSENT_ALERT_OFFSET_MINUTES,
      'minute',
    );
    if (!deadline.isValid() || now.isBefore(deadline)) return;

    // Skip non-working days entirely (Settings → working days, e.g. Sunday off).
    const workingDays = Array.isArray(settings?.workingDays) ? settings.workingDays : [];
    if (workingDays.length > 0 && !workingDays.includes(now.format('dddd'))) return;

    // Once-per-day guard so repeated sweeps / clustered instances never spam.
    const guardKey = `absent_alert_${today}`;
    const already = await notificationRepository.queries.findByMetaKey(
      'ABSENT_ALERT',
      'guardKey',
      guardKey,
    );
    if (already) return;

    const staff = await userRepository.queries.listActiveStaff();
    if (!staff.length) return;

    const [punchIns, approvedLeaves, dayOffs] = await Promise.all([
      attendanceRepository.queries.listClockInsByDateSelectUser(today),
      leaveRepository.queries.listAll('APPROVED'),
      dayOffRepository.queries.listByDateRange({ startDate: today, endDate: today }),
    ]);

    const punchedIn = new Set(punchIns.map((p) => String(p.user)));
    // Midday reference avoids TZ edge cases in leave date comparisons.
    const day = new Date(`${today}T12:00:00`);
    const userIdOf = (ref: unknown): string => {
      const s = String(ref);
      return s.includes('[object') ? String((ref as { _id?: string })?._id ?? '') : s;
    };
    const onLeave = new Set(
      approvedLeaves
        .filter((l) => new Date(l.startDate) <= day && new Date(l.endDate) >= day)
        .map((l) => userIdOf(l.user)),
    );
    const onDayOff = new Set(dayOffs.map((e) => userIdOf(e.user)));

    const absent = staff.filter((s) => {
      const id = String(s._id);
      return !punchedIn.has(id) && !onLeave.has(id) && !onDayOff.has(id);
    });
    if (absent.length === 0) return;

    const names = absent.map((s) => String(s.name || 'Staff'));
    const rows: TemplateRow[] = absent.map((s) => [
      String(s.name || 'Staff'),
      `${String(s.role || 'STAFF')} · shift ${String(s.shiftStartTime || shiftStart)}${
        s.email ? ` · ${String(s.email)}` : ''
      }`,
    ]);

    await notificationService.notifyAdmins({
      type: 'ABSENT_ALERT',
      title: `Absence alert – ${absent.length} staff absent`,
      message: `Aaj clock-in nahi hua: ${names.join(', ')}`,
      link: '/attendance',
      pill: { label: 'Attendance', tone: 'error' },
      rows,
      meta: { guardKey, date: today, absentUserIds: absent.map((s) => String(s._id)) },
    });
    logger.info(`Absent alert dispatched for ${today}: ${names.join(', ')}`);
  } catch (error) {
    logger.error('Absent alert sweep failed', error);
  }
};

/** Boot scheduler: first sweep 5 minutes after start, then every 10 minutes. */
export const startAbsentAlertScheduler = (): void => {
  setTimeout(() => void checkAbsentStaff(), 5 * 60 * 1000);
  setInterval(() => void checkAbsentStaff(), 10 * 60 * 1000);
};