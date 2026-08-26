import dayjs from 'dayjs';
import { DEFAULTS } from '../../config/constants.js';
import {
  ConflictError,
  GeofenceError,
  NotFoundError,
  ValidationError,
  VPNDetectedError,
} from '../../shared/errors/app.errors.js';
import { logger } from '../../shared/logger/logger.js';
import { todayISO } from '../../shared/utils/date.util.js';
import { checkGeofence, type GeoPoint } from '../../shared/utils/geofence.util.js';
import { checkTimezoneMismatch, checkVPN, checkWebRTCMismatch } from '../../shared/utils/vpn-detector.util.js';
import { saveBase64Image } from '../../shared/utils/file-upload.util.js';
import { monthStartISO, monthEndISO, toISODate } from '../../shared/utils/date.util.js';
import { notificationService } from '../notification/notification.service.js';
import { notificationRepository } from '../notification/notification.repository.js';
import { dayOffRepository } from '../day-off/day-off.repository.js';
import { attendanceRepository } from './attendance.repository.js';
import { settingsRepository } from '../settings/settings.repository.js';
import { userRepository } from '../user/user.repository.js';
import { officeRepository } from '../office/office.repository.js';
import type { AttendanceDocument } from './attendance.model.js';
import { mailService } from '../../shared/mail/mail.service.js';

export interface ClockInputShape {
  selfieBase64: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string | null;
  browserTimezone: string;
  webRTCIPs?: string[] | null;
  faceMatched?: boolean | null;
  faceMatchScore?: number | null;
}

export interface ClockResult {
  success: boolean;
  message: string;
  attendance: AttendanceDocument;
  vpnDetected: boolean;
  distanceFromOffice: number;
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * ATTENDANCE SERVICE – SINGLETON for punches, summaries & dashboards
 * ────────────────────────────────────────────────────────────────────────────
 */
class AttendanceService {
  private static instance: AttendanceService | null = null;

  private constructor() {}

  public static getInstance(): AttendanceService {
    if (!AttendanceService.instance) {
      AttendanceService.instance = new AttendanceService();
    }
    return AttendanceService.instance;
  }

  /**
   * Process a clock-in or clock-out request.
   * Security layers: GPS accuracy → VPN API → WebRTC mismatch → timezone
   * mismatch → geofence rotation (temp duty wins over permanent office).
   */
  public async processPunch(args: {
    userId: string;
    type: 'CLOCK_IN' | 'CLOCK_OUT';
    input: ClockInputShape;
    ipAddress?: string | null;
  }): Promise<ClockResult> {
    const { userId, type, input, ipAddress } = args;
    const today = todayISO();

    // ── Duplicate / sequence guards ──
    const existingPunch = await attendanceRepository.queries.findByUserDateType(userId, today, type);
    if (existingPunch) {
      throw new ValidationError(`Already ${type === 'CLOCK_IN' ? 'clocked in' : 'clocked out'} today`);
    }

    if (type === 'CLOCK_OUT') {
      const clockIn = await attendanceRepository.queries.findByUserDateType(userId, today, 'CLOCK_IN');
      if (!clockIn) throw new ValidationError('Cannot clock out without clocking in first');
    }

    // Layer 1: GPS accuracy check (500m ceiling – desktop Wi-Fi is coarse).
    if (input.accuracy > 500) {
      throw new ValidationError('Location accuracy too low. Please enable GPS/Wi-Fi on your device.');
    }

    // Org settings drive the VPN policy & geofence fallbacks.
    const settings = await settingsRepository.queries.findFirstLean();

    // Layers 2-4: VPN API + WebRTC + timezone mismatch (fail-open).
    const vpnResult = await checkVPN(ipAddress);
    const webrtcMismatch = checkWebRTCMismatch(ipAddress, input.webRTCIPs ?? []);
    const timezoneMismatch = checkTimezoneMismatch(input.browserTimezone, vpnResult.ipTimezone);
    const vpnDetected = vpnResult.isVPN || webrtcMismatch;

    /**
     * VPN POLICY (Admin → Settings):
     *   strict ON  → punch blocked outright
     *   strict OFF → punch succeeds but lands PENDING for admin review.
     */
    if (vpnDetected && settings?.vpnStrictMode) {
      throw new VPNDetectedError('VPN or Proxy detected. Please disable VPN to mark attendance.');
    }

    // ── Multi-store geofence & branch rotation check ──
    const user = await userRepository.queries.findById(userId, { populate: ['assignedOffice'] });
    const allActiveOffices = await officeRepository.queries.listActiveAny();

    let withinGeofence = false;
    let distance = 0;
    let punchedOffice: string | null = null;
    let isCoverDuty = false;
    let branchName = 'Head Office';
    let nearestDistance = Infinity;
    let nearestOfficeName = 'Designated Store';

    // Resolve the EFFECTIVE site: an active TEMP DUTY assignment wins over the
    // permanent one; expired temp assignments are ignored automatically.
    let effectiveOffice = (user?.assignedOffice ?? null) as unknown as {
      _id: unknown;
      latitude: number;
      longitude: number;
      geofenceRadius?: number;
      name: string;
    } | null;

    const ta = user?.temporaryAssignment;
    if (ta?.office) {
      const todayStart = dayjs(today).startOf('day');
      const taStart = dayjs(ta.startDate).startOf('day');
      const taEnd = dayjs(ta.endDate).endOf('day');
      const isActiveNow = !todayStart.isBefore(taStart) && !todayStart.isAfter(taEnd);

      if (isActiveNow) {
        const taOfficeId = String(
          (ta.office as unknown as { _id?: unknown; toString(): string })._id ??
            (ta.office as unknown as { toString(): string }),
        );
        effectiveOffice =
          (allActiveOffices.find((o) => String(o._id) === taOfficeId) as typeof effectiveOffice) ??
          effectiveOffice;
      }
    }

    const permanentOfficeId = user?.assignedOffice
      ? String((user.assignedOffice as unknown as { _id?: unknown })._id ?? user.assignedOffice)
      : null;

    // 1. Check effective office first (temp duty overrides permanent assignment).
    if (effectiveOffice) {
      const assignedCoords: GeoPoint = {
        latitude: effectiveOffice.latitude,
        longitude: effectiveOffice.longitude,
      };
      const radius = effectiveOffice.geofenceRadius || DEFAULTS.GEOFENCE_RADIUS_METERS;
      const res = checkGeofence(
        { latitude: input.latitude, longitude: input.longitude },
        assignedCoords,
        radius,
      );

      if (res.withinGeofence) {
        withinGeofence = true;
        distance = res.distance;
        punchedOffice = String(effectiveOffice._id);
        isCoverDuty = false;
        branchName = effectiveOffice.name;
      } else {
        nearestDistance = res.distance;
        nearestOfficeName = effectiveOffice.name;
      }
    }

    // 2. Not at assigned office → try every active branch (cover-duty rotation).
    if (!withinGeofence && allActiveOffices.length > 0) {
      for (const office of allActiveOffices) {
        const res = checkGeofence(
          { latitude: input.latitude, longitude: input.longitude },
          { latitude: office.latitude, longitude: office.longitude },
          office.geofenceRadius || DEFAULTS.GEOFENCE_RADIUS_METERS,
        );

        if (res.distance < nearestDistance) {
          nearestDistance = res.distance;
          nearestOfficeName = office.name;
        }

        if (res.withinGeofence) {
          withinGeofence = true;
          distance = res.distance;
          punchedOffice = String(office._id);
          isCoverDuty = permanentOfficeId ? permanentOfficeId !== String(office._id) : false;
          branchName = office.name;
          break;
        }
      }
    }

    // 3. Fallback to global settings when no offices exist at all.
    if (!withinGeofence && allActiveOffices.length === 0 && !effectiveOffice) {
      const fallbackCoords: GeoPoint = {
        latitude: settings?.officeLatitude ?? 28.6139,
        longitude: settings?.officeLongitude ?? 77.209,
      };
      const res = checkGeofence(
        { latitude: input.latitude, longitude: input.longitude },
        fallbackCoords,
        settings?.geofenceRadius || DEFAULTS.GEOFENCE_RADIUS_METERS,
      );
      if (res.withinGeofence) {
        withinGeofence = true;
        distance = res.distance;
        branchName = settings?.officeName || 'Main Store';
      } else {
        nearestDistance = res.distance;
        nearestOfficeName = settings?.officeName || 'Main Store';
      }
    }

    if (!withinGeofence) {
      throw new GeofenceError(
        `You are ${nearestDistance}m away from the nearest store (${nearestOfficeName}). You must be inside an authorized homeopathic store.`,
      );
    }

    // ── Selfie persistence ──
    const filename = `${userId}_${type.toLowerCase()}_${today}_${Date.now()}`;
    const selfieUrl = await saveBase64Image(input.selfieBase64, filename);

    // ── APPROVAL POLICY (modern HRMS behaviour) ──
    // A CLEAN punch (inside geofence + face verified + no flag) is auto-APPROVED
    // so admins only review genuine anomalies. Anything suspicious stays PENDING.
    const hasIdentityFlag = vpnDetected || input.faceMatched === false;
    const faceVerified = input.faceMatched === true;
    const autoApproved =
      !hasIdentityFlag && faceVerified && settings?.autoApproveAttendance !== false;

    const attendance = await (async () => {
      try {
        return await attendanceRepository.queries.create({
          user: userId as never,
          punchedOffice: (punchedOffice ?? null) as never,
          isCoverDuty,
          type,
          selfieUrl,
          location: {
            latitude: input.latitude,
            longitude: input.longitude,
            accuracy: input.accuracy,
            address: input.address || '',
            withinGeofence,
            distanceFromOffice: distance,
            branchName,
            isCoverDuty,
          },
          ipAddress: ipAddress ?? '',
          vpnDetected,
          vpnCheckDetails: {
            vpn: vpnResult.vpn,
            proxy: vpnResult.proxy,
            tor: vpnResult.tor,
            webrtcMismatch,
            timezoneMismatch,
          },
          browserTimezone: input.browserTimezone || '',
          date: today,
          faceMatched: typeof input.faceMatched === 'boolean' ? input.faceMatched : undefined,
          faceMatchScore: typeof input.faceMatchScore === 'number' ? input.faceMatchScore : undefined,
          approvalStatus: autoApproved ? 'APPROVED' : 'PENDING',
          // Flagged punches carry the reason so the reviewer sees WHY instantly.
          ...(hasIdentityFlag
            ? {
                adminComments: vpnDetected
                  ? 'Auto-flagged: possible VPN/proxy or device mismatch'
                  : 'Auto-flagged: face did not match registered profile photo',
              }
            : {}),
        });
      } catch (error) {
        // ⚡ Race fallback: the unique index caught a simultaneous duplicate
        // punch that slipped past the findOne pre-check above.
        if (error instanceof ConflictError || (error as { code?: number }).code === 11000) {
          throw new ValidationError(
            `Already ${type === 'CLOCK_IN' ? 'clocked in' : 'clocked out'} today`,
          );
        }
        throw error;
      }
    })();

    await attendance.populate('user');

    if (vpnDetected || input.faceMatched === false) {
      const staffName = (attendance.user as unknown as { name?: string })?.name || 'A staff member';
      await notificationService.notifyAdmins({
        type: 'ATTENDANCE_FLAGGED',
        title: 'Flagged punch needs review',
        message: `${staffName} punched ${type === 'CLOCK_IN' ? 'IN' : 'OUT'} at ${branchName}${vpnDetected ? ', but a VPN/proxy or device mismatch was detected' : ', but the face did NOT match their registered profile photo'}.`,
        link: `/approvals?focus=${attendance._id}#attendance`,
        pill: { label: 'SECURITY FLAG', tone: 'error' },
        rows: [
          ['Employee', staffName],
          ['Punch Type', type === 'CLOCK_IN' ? 'CLOCK IN' : 'CLOCK OUT'],
          ['Location', branchName],
          ['Flag Reason', vpnDetected ? 'VPN / Location Spoofing Detected' : 'Face Verification Failed'],
        ],
        noteText: 'Please review this punch in the Admin Dashboard and approve or reject it.',
        meta: { attendanceId: String(attendance._id) },
        excludeUserId: userId,
      });
    }

    const verb = type === 'CLOCK_IN' ? 'Clocked in' : 'Clocked out';
    const successMsg = hasIdentityFlag
      ? `${verb} – recorded, pending admin review (identity flag)`
      : autoApproved
        ? `${verb} at ${branchName} – attendance recorded & auto-approved`
        : isCoverDuty
          ? `${verb} (Cover Duty at ${branchName}) – pending admin approval`
          : `${verb} at ${branchName} – recorded, pending admin approval`;

    return {
      success: true,
      message: successMsg,
      attendance,
      vpnDetected,
      distanceFromOffice: distance,
    };
  }

  /**
   * Attendance summary for a date range – groups punches per user/day, injects
   * day-off rows and derives the daily status (PRESENT/LATE/HALF_DAY/…).
   */
  public async getSummary(args: {
    userId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    allUsers?: boolean;
  }): Promise<unknown[]> {
    const settings = await settingsRepository.queries.findFirstLean();
    const lateThreshold = settings?.lateThresholdMinutes || DEFAULTS.LATE_THRESHOLD_MINUTES;
    const shiftStart = settings?.shiftStartTime || DEFAULTS.SHIFT_START;

    const userId = args.allUsers ? null : args.userId ?? null;

    const records = await attendanceRepository.queries.listByDateRange({
      userId,
      startDate: args.startDate ?? null,
      endDate: args.endDate ?? null,
    });

    // Day-off exemptions in range → shown as EXEMPT rows even without punches.
    const exemptions = await dayOffRepository.queries.listByDateRange({
      userId: userId ?? undefined,
      startDate: args.startDate ?? undefined,
      endDate: args.endDate ?? undefined,
    });

    // Group by user + date
    const grouped = new Map<string, { date: string; user: unknown; clockIn: AttendanceDocument | null; clockOut: AttendanceDocument | null }>();
    for (const record of records) {
      const u = record.user as unknown as { _id: unknown };
      const key = `${u._id}_${record.date}`;
      if (!grouped.has(key)) {
        grouped.set(key, { date: record.date, user: record.user, clockIn: null, clockOut: null });
      }
      const entry = grouped.get(key)!;
      if (record.type === 'CLOCK_IN') entry.clockIn = record;
      if (record.type === 'CLOCK_OUT') entry.clockOut = record;
    }

    for (const exemption of exemptions) {
      if (!exemption.user) continue;
      const u = exemption.user as unknown as { _id: unknown };
      const key = `${u._id}_${exemption.date}`;
      if (!grouped.has(key)) {
        grouped.set(key, { date: exemption.date, user: exemption.user, clockIn: null, clockOut: null });
      }
    }

    const exemptionKeys = new Set(
      exemptions.map((e) => `${(e.user as unknown as { _id?: unknown })?._id ?? e.user}_${e.date}`),
    );

    return [...grouped.values()].map((entry) => {
      let totalHours = 0;
      if (entry.clockIn && entry.clockOut) {
        totalHours = dayjs(entry.clockOut.createdAt).diff(dayjs(entry.clockIn.createdAt), 'hour', true);
        totalHours = Math.round(totalHours * 100) / 100;
      }

      let status = 'ABSENT';
      if (exemptionKeys.has(`${(entry.user as unknown as { _id: unknown })._id}_${entry.date}`)) {
        status = 'EXEMPT';
      } else if (entry.clockIn) {
        if (entry.clockIn.approvalStatus === 'PENDING' || entry.clockOut?.approvalStatus === 'PENDING') {
          status = 'PENDING';
        } else if (entry.clockIn.approvalStatus === 'REJECTED' || entry.clockOut?.approvalStatus === 'REJECTED') {
          status = 'REJECTED';
        } else {
          const clockInTime = dayjs(entry.clockIn.createdAt);
          const userShift =
            (entry.user as unknown as { shiftStartTime?: string })?.shiftStartTime || shiftStart;
          const shiftStartTime = dayjs(`${entry.date}T${userShift}`);
          const lateBy = clockInTime.diff(shiftStartTime, 'minute');

          status =
            lateBy > lateThreshold ? (totalHours < 4 ? 'HALF_DAY' : 'LATE') : 'PRESENT';
        }
      }

      return { ...entry, totalHours, status };
    });
  }

  /** Today's dashboard tiles – REJECTED punches never inflate the numbers. */
  public async getDashboardStats(): Promise<{
    totalStaff: number;
    presentToday: number;
    lateToday: number;
    absentToday: number;
    onLeaveToday: number;
  }> {
    const today = todayISO();
    const totalStaff = await userRepository.queries.countActiveStaff();
    const todayRecords = await attendanceRepository.queries.listClockInsByDate(today);

    const settings = await settingsRepository.queries.findFirstLean();
    const shiftStart = settings?.shiftStartTime || DEFAULTS.SHIFT_START;
    const lateThreshold = settings?.lateThresholdMinutes || DEFAULTS.LATE_THRESHOLD_MINUTES;

    // Day-offs and approved leaves must NOT count as absent.
    const [exemptToday, onLeaveToday] = await Promise.all([
      dayOffRepository.queries.countByDate(today),
      leaveCountForDay(today),
    ]);

    let late = 0;

    // Approval-gated policy: REJECTED punches are INVALID attendance.
    const validRecords = todayRecords.filter((r) => r.approvalStatus !== 'REJECTED');

    for (const record of validRecords) {
      const clockInTime = dayjs(record.createdAt);
      const userShift =
        (record.user as unknown as { shiftStartTime?: string })?.shiftStartTime || shiftStart;
      const shiftStartTime = dayjs(`${today}T${userShift}`);
      if (clockInTime.diff(shiftStartTime, 'minute') > lateThreshold) {
        late += 1;
      }
    }

    return {
      totalStaff,
      presentToday: validRecords.length,
      lateToday: late,
      absentToday: Math.max(0, totalStaff - validRecords.length - exemptToday - onLeaveToday),
      onLeaveToday: onLeaveToday + exemptToday,
    };
  }

  /** Monthly trend data for charts (per-day present/late/absent counts). */
  public async getMonthlyTrend(month: number, year: number): Promise<unknown[]> {
    const startDate = monthStartISO(month, year);
    const endDate = monthEndISO(month, year);
    const totalStaff = await userRepository.queries.countActiveStaff();

    const records = await attendanceRepository.queries.listClockInsBetween(startDate, endDate);

    // REJECTED punches are invalid attendance – exclude from trend charts.
    const validRecords = records.filter((r) => r.approvalStatus !== 'REJECTED');

    const settings = await settingsRepository.queries.findFirstLean();
    const shiftStart = settings?.shiftStartTime || DEFAULTS.SHIFT_START;
    const lateThreshold = settings?.lateThresholdMinutes || DEFAULTS.LATE_THRESHOLD_MINUTES;

    // Group by date
    const byDate = new Map<string, { present: number; late: number }>();
    for (const r of validRecords) {
      if (!byDate.has(r.date)) byDate.set(r.date, { present: 0, late: 0 });
      const bucket = byDate.get(r.date)!;
      const clockInTime = dayjs(r.createdAt);
      const userShift =
        (r.user as unknown as { shiftStartTime?: string })?.shiftStartTime || shiftStart;
      const shiftStartTime = dayjs(`${r.date}T${userShift}`);
      if (clockInTime.diff(shiftStartTime, 'minute') > lateThreshold) {
        bucket.late += 1;
      } else {
        bucket.present += 1;
      }
    }

    const daysInMonth = dayjs(startDate).daysInMonth();

    // Exempted staff-days reduce the "absent" bar in the monthly trend.
    const exemptDocs = await dayOffRepository.queries.listDatesInRange(startDate, endDate);
    const exemptCountByDate = new Map<string, number>();
    for (const e of exemptDocs) {
      exemptCountByDate.set(e.date, (exemptCountByDate.get(e.date) ?? 0) + 1);
    }

    const trend: unknown[] = [];
    for (let dNum = 1; dNum <= daysInMonth; dNum++) {
      const date = toISODate(
        `${year}-${String(month).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`,
      );
      const data = byDate.get(date) ?? { present: 0, late: 0 };
      const exemptCount = exemptCountByDate.get(date) ?? 0;
      trend.push({
        date,
        presentCount: data.present,
        lateCount: data.late,
        absentCount: Math.max(0, totalStaff - data.present - data.late - exemptCount),
      });
    }

    return trend;
  }

  /** Admin review of a flagged punch – closes inbox items & notifies staff. */
  public async reviewPunch(args: {
    id: string;
    status: string;
    adminComments?: string | null;
    reviewer: { id: string };
  }): Promise<AttendanceDocument> {
    const record = await attendanceRepository.queries.findById(args.id);
    if (!record) throw new NotFoundError('Attendance record not found');

    record.approvalStatus = args.status as AttendanceDocument['approvalStatus'];
    record.approvedBy = args.reviewer.id as never;
    if (args.adminComments !== undefined && args.adminComments !== null) {
      record.adminComments = args.adminComments;
    }

    await record.save();
    const populated = (await record.populate('user')) as AttendanceDocument;

    // Close the "Flagged punch needs review" notification in every admin's
    // inbox – reviewed punches must not keep showing up as unread.
    await notificationRepository.queries.closeMetaNotifications(
      'ATTENDANCE_FLAGGED',
      'attendanceId',
      String(record._id),
    );

    // Self-review guard – reviewer never gets pinged about their own punch.
    const staffId = String((populated.user as unknown as { _id: unknown })._id);
    const isSelfReview = staffId === String(args.reviewer.id);

    if (!isSelfReview) {
      await notificationService.push({
        recipientIds: [staffId],
        type: 'ATTENDANCE_DECISION',
        title: args.status === 'APPROVED' ? 'Attendance approved' : 'Attendance rejected',
        message: `${dayjs(record.date).format('MMM D')} · ${record.type === 'CLOCK_IN' ? 'Clock-in' : 'Clock-out'}${args.adminComments ? ` · ${args.adminComments}` : ''}`,
        link: '/history',
        meta: { attendanceId: String(record._id) },
      });

      void mailService
        .sendAttendanceReviewEmail(populated.user as never, {
          status: args.status,
          date: dayjs(record.date).format('MMM D, YYYY'),
          punchType: record.type === 'CLOCK_IN' ? 'Clock-in' : 'Clock-out',
          comments: args.adminComments,
        })
        .catch((e) => logger.error(e));
    }

    return populated;
  }

  /** Admin feed of latest punches across everyone (or one staff member). */
  public recentActivity(
    filter: Record<string, unknown>,
    limit = 10,
  ): Promise<AttendanceDocument[]> {
    return attendanceRepository.queries.recentActivity(filter, limit);
  }
}

/** Approved-leave counter for a single day (dashboard "on leave" tile). */
const leaveCountForDay = async (today: string): Promise<number> => {
  const { LeaveRequestModel } = await import('../leave/leave.model.js');
  return LeaveRequestModel.countDocuments({
    status: 'APPROVED',
    startDate: { $lte: today },
    endDate: { $gte: today },
  });
};

export const attendanceService = AttendanceService.getInstance();
