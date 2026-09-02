import dayjs from 'dayjs';
import { DEFAULTS } from '../../config/constants.js';
import {
  GeofenceError,
  NotFoundError,
  ValidationError,
  VPNDetectedError,
  FingerprintNotRegisteredError,
  FingerprintRequiredError,
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
import { leaveRepository } from '../leave/leave.repository.js';
import type { AttendanceDocument, IAttendance } from './attendance.model.js';
import type { IUserDocument } from '../user/user.model.js';
import { mailService } from '../../shared/mail/mail.service.js';
import { getFaceEmbeddingFromBase64, cosineSimilarity, checkLiveness, FACE_MATCH_THRESHOLD } from '../../shared/utils/face.util.js';
import { webauthnService } from '../webauthn/webauthn.service.js';
import { env } from '../../config/env.js';

export interface ClockInputShape {
  /** Optional – empty for FINGERPRINT punches (no camera needed). */
  selfieBase64?: string | null;
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string | null;
  browserTimezone: string;
  webRTCIPs?: string[] | null;
  faceMatched?: boolean | null;
  faceMatchScore?: number | null;
  livenessFrames?: string[] | null;
  /** WebAuthn assertion (JSON) from a successful fingerprint/Face-ID ceremony. */
  webauthnResponse?: string | null;
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
  /**
   * Server-side face verification for a punch selfie against the user's enrolled
   * SFace embedding. Returns null (→ caller falls back to client-provided values)
   * when the face-service is not configured or the user has no enrollment.
   * Never throws – a service/network hiccup must not block a punch.
   */
  private async verifyPunchFace(
    userId: string,
    selfieBase64: string,
  ): Promise<{ match: boolean; similarity: number } | null> {
    if (!env.faceServiceUrl) return null; // feature off → keep client values
    try {
      const enrolled = await userRepository.queries.getFaceVector(userId);
      if (!enrolled || enrolled.length === 0) {
        logger.warn(`[face] user ${userId} has NO enrolled face vector → skipping match`);
        return null; // not enrolled yet
      }

      const live = await getFaceEmbeddingFromBase64(selfieBase64);
      if (!live) {
        // Face service reachable but no face in the selfie → explicit mismatch.
        logger.warn('[face] no face detected in the live selfie → mismatch');
        return { match: false, similarity: 0 };
      }

      const similarity = cosineSimilarity(live, enrolled);
      logger.info(
        `[face] similarity=${similarity.toFixed(4)} threshold=${FACE_MATCH_THRESHOLD} ` +
          `match=${similarity >= FACE_MATCH_THRESHOLD} (enrolledDim=${enrolled.length}, liveDim=${live.length})`,
      );
      return { match: similarity >= FACE_MATCH_THRESHOLD, similarity };
    } catch (error) {
      logger.error('Server-side face verification failed', error);
      return null; // fail-open to client-provided values
    }
  }

  /**
   * One "register your fingerprint" reminder email per 24h (daily dedupe) so a
   * failing FINGERPRINT-mode punch never spams the staff member's inbox.
   */
  private async ensureFingerprintReminderEmail(user: IUserDocument): Promise<void> {
    const last = user.lastFingerprintReminderAt ? new Date(user.lastFingerprintReminderAt).getTime() : 0;
    if (Date.now() - last < 24 * 60 * 60 * 1000) return;
    void mailService
      .sendFingerprintReminderEmail(user)
      .catch((error) => logger.error('Fingerprint reminder email failed', error));
    await userRepository.queries.markFingerprintReminderSent(String(user._id));
  }

  public async processPunch(args: {
    userId: string;
    type: 'CLOCK_IN' | 'CLOCK_OUT';
    input: ClockInputShape;
    ipAddress?: string | null;
  }): Promise<ClockResult> {
    const { userId, type, input, ipAddress } = args;
    const today = todayISO();

    // ── Multi-session sequence guard (Zoho People-style) ──
    // A user may clock in/out many times a day. The ONLY invalid moves are
    // punching the same direction twice in a row: the LAST punch of the day
    // decides what's allowed next.
    //   last = CLOCK_IN  → a session is OPEN  → only CLOCK_OUT allowed
    //   last = CLOCK_OUT / none → no open session → only CLOCK_IN allowed
    const todaysPunches = await attendanceRepository.queries.listByUserDate(userId, today);
    const lastPunch = todaysPunches[todaysPunches.length - 1] ?? null;
    const sessionOpen = lastPunch?.type === 'CLOCK_IN';

    if (type === 'CLOCK_IN' && sessionOpen) {
      throw new ValidationError('You are already clocked in. Please clock out first.');
    }
    if (type === 'CLOCK_OUT' && !sessionOpen) {
      throw new ValidationError('You are not clocked in. Please clock in first.');
    }

    // Layer 1: GPS accuracy check (500m ceiling – desktop Wi-Fi is coarse).
    if (input.accuracy > 500) {
      throw new ValidationError('Location accuracy too low. Please enable GPS/Wi-Fi on your device.');
    }

    // All independent reads fire in parallel: org settings (policy), the staff
    // profile (assigned site + temp duty), every active branch (geofence
    // rotation) and the VPN/IP-intel API (fail-open, never throws). These were
    // four serial network round-trips against the remote Supabase cluster
    // (~163ms each) – overlapping them cuts ~0.5s off every punch.
    const [settings, user, allActiveOffices, vpnResult] = await Promise.all([
      settingsRepository.queries.findFirstLean(),
      userRepository.queries.findById(userId, { populate: ['assignedOffice'] }),
      officeRepository.queries.listActiveAny(),
      checkVPN(ipAddress),
    ]);

    if (!user) throw new NotFoundError('Staff profile not found. Please contact your administrator.');

    // Layers 2-4: VPN API + WebRTC + timezone mismatch (fail-open).
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

    // ── IDENTITY METHOD (Admin → Settings: FACE / FINGERPRINT / BOTH) ──────────
    // FINGERPRINT punches are verified server-side with the phone's own sensor
    // via WebAuthn – the camera/selfie/liveness pipeline is skipped entirely.
    // requireUserVerification is enforced so the phone MUST use the fingerprint
    // / Face-ID / PIN – a mere presence tap is rejected by the library.
    const attendanceMethod = settings?.attendanceMethod ?? 'FACE';
    let fingerprintVerified = false;
    if (attendanceMethod === 'FINGERPRINT' || attendanceMethod === 'BOTH') {
      if (input.webauthnResponse) {
        // Throws AuthenticationError when the fingerprint/Face-ID check fails.
        await webauthnService.verifyAuthenticationForPunch(user, input.webauthnResponse);
        fingerprintVerified = true;
      } else if (attendanceMethod === 'FINGERPRINT') {
        if (!webauthnService.hasPasskey(user)) {
          await this.ensureFingerprintReminderEmail(user);
          throw new FingerprintNotRegisteredError(
            'Your fingerprint is not registered yet. Open My Profile → Fingerprint to register it. A reminder email has been sent.',
          );
        }
        throw new FingerprintRequiredError(
          'Fingerprint verification is required to punch. Please scan your fingerprint.',
        );
      }
    }

    let withinGeofence = false;
    let distance = 0;
    let punchedOffice: string | null = null;
    let isCoverDuty = false;
    let branchName = 'Head Office';
    let nearestDistance = Infinity;
    let nearestOfficeName = 'Designated Store';

    // The repository never hydrates assigned refs (only the GraphQL resolver
    // does) – `user.assignedOffice` is a raw UUID string here. Resolve it to the
    // real office ourselves. Without this the assigned-site geofence check below
    // ran against a string with no coordinates and ALWAYS failed, so a staff
    // member's punch fell through to "whatever branch is nearest" instead of their
    // designated site (the exact location-mismatch bug in attendance records).
    const assignedRaw = user?.assignedOffice ?? null;
    const assignedOfficeId =
      typeof assignedRaw === 'string'
        ? assignedRaw
        : (assignedRaw as { _id?: unknown } | null)?._id ?? null;
    // The designated site is usually one of the ACTIVE branches we already
    // fetched in parallel – resolve it from that list and only hit the DB on
    // the rare inactive-office case (removes a whole round-trip per punch).
    const hydratedAssignedOffice = assignedOfficeId
      ? (allActiveOffices.find((o) => String(o._id) === assignedOfficeId) ??
        (await officeRepository.queries.findById(String(assignedOfficeId))))
      : null;

    // Resolve the EFFECTIVE site: an active TEMP DUTY assignment wins over the
    // permanent one; expired temp assignments are ignored automatically.
    let effectiveOffice = hydratedAssignedOffice as unknown as {
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

    // ── Selfie persistence (skipped entirely for fingerprint punches) ──
    let selfieUrl = '';
    if (input.selfieBase64) {
      const filename = `${userId}_${type.toLowerCase()}_${today}_${Date.now()}`;
      selfieUrl = await saveBase64Image(input.selfieBase64, filename);
    }

    // ── APPROVAL POLICY (modern HRMS behaviour) ──
    // ── Server-side face verification (SFace via face-service) ──
    // Authoritative when the face-service is configured AND the user is enrolled.
    // Falls back to the client-provided values so nothing breaks before deploy.
    // Runs ONLY when a selfie was captured (fingerprint punches skip it).
    let faceMatched: boolean | null | undefined = fingerprintVerified ? null : input.faceMatched;
    let faceMatchScore: number | null | undefined = fingerprintVerified ? null : input.faceMatchScore;
    if (input.selfieBase64) {
      const verify = await this.verifyPunchFace(userId, input.selfieBase64);
      if (verify) {
        faceMatched = verify.match;
        faceMatchScore = verify.similarity;
      }
    }

    // ── Server-side active liveness (head-turn via face-service) ──
    // null → service off or no frames sent → skip (don't block). false → the
    // burst did not show a live head-turn → flag for review. Skipped for
    // fingerprint punches – the phone's own biometric liveness already proved it.
    let livenessFailed = false;
    if (input.selfieBase64) {
      const liveness = await checkLiveness(input.livenessFrames ?? []);
      livenessFailed = liveness !== null && liveness.live === false;
    }

    // A CLEAN punch (inside geofence + identity verified + no flag) is
    // auto-APPROVED so admins only review genuine anomalies. Fingerprint punches
    // are auto-approved because the phone cryptographically confirmed identity;
    // face punches additionally need the face to match the enrolled selfie.
    const hasIdentityFlag =
      vpnDetected || (!fingerprintVerified && (faceMatched === false || livenessFailed));
    const identityVerified = fingerprintVerified || faceMatched === true;
    const autoApproved =
      !hasIdentityFlag && identityVerified && settings?.autoApproveAttendance !== false;
    const identityMethod: 'FACE' | 'FINGERPRINT' = fingerprintVerified ? 'FINGERPRINT' : 'FACE';

    let attendance = await (async () => {
      try {
        return await attendanceRepository.queries.create({
          user: userId as never,
          punchedOffice: (punchedOffice ?? null) as never,
          isCoverDuty,
          type,
          selfieUrl,
          identityMethod,
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
          faceMatched: typeof faceMatched === 'boolean' ? faceMatched : undefined,
          faceMatchScore: typeof faceMatchScore === 'number' ? faceMatchScore : undefined,
          approvalStatus: autoApproved ? 'APPROVED' : 'PENDING',
          // Flagged punches carry the reason so the reviewer sees WHY instantly.
          ...(hasIdentityFlag
            ? {
                adminComments: vpnDetected
                  ? 'Auto-flagged: possible VPN/proxy or device mismatch'
                  : faceMatched === false
                    ? 'Auto-flagged: face did not match registered profile photo'
                    : 'Auto-flagged: liveness check failed (no head movement detected)',
              }
            : {}),
        });
      } catch (error) {
        // Multi-session: duplicate punches are allowed, so there's no longer a
        // unique-index race to translate. Surface any real DB error as-is.
        throw error;
      }
    })();

    attendance = (await attendanceRepository.queries.findByIdPopulated(String(attendance._id))) ?? attendance;

    if (vpnDetected || faceMatched === false || livenessFailed) {
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
    const userId = args.allUsers ? null : args.userId ?? null;

    // Independent reads fire in parallel: org settings (lateness policy), the
    // range's punch rows and the day-off exemptions. Previously three serial
    // network round-trips (~0.5s against the remote cluster).
    const [settings, records, exemptions] = await Promise.all([
      settingsRepository.queries.findFirstLean(),
      attendanceRepository.queries.listByDateRange({
        userId,
        startDate: args.startDate ?? null,
        endDate: args.endDate ?? null,
      }),
      dayOffRepository.queries.listByDateRange({
        userId: userId ?? undefined,
        startDate: args.startDate ?? undefined,
        endDate: args.endDate ?? undefined,
      }),
    ]);

    const lateThreshold = settings?.lateThresholdMinutes || DEFAULTS.LATE_THRESHOLD_MINUTES;
    const shiftStart = settings?.shiftStartTime || DEFAULTS.SHIFT_START;

    // ── Group ALL punches per user + date (multi-session) ──
    // Each day can hold many CLOCK_IN/CLOCK_OUT punches. We keep every punch,
    // then pair them in time order into sessions and sum the durations.
    const grouped = new Map<string, { date: string; user: unknown; punches: AttendanceDocument[] }>();
    for (const record of records) {
      const u = record.user as unknown as { _id: unknown };
      const key = `${u._id}_${record.date}`;
      if (!grouped.has(key)) {
        grouped.set(key, { date: record.date, user: record.user, punches: [] });
      }
      grouped.get(key)!.punches.push(record);
    }

    for (const exemption of exemptions) {
      if (!exemption.user) continue;
      const u = exemption.user as unknown as { _id: unknown };
      const key = `${u._id}_${exemption.date}`;
      if (!grouped.has(key)) {
        grouped.set(key, { date: exemption.date, user: exemption.user, punches: [] });
      }
    }

    const exemptionKeys = new Set(
      exemptions.map((e) => `${(e.user as unknown as { _id?: unknown })?._id ?? e.user}_${e.date}`),
    );

    return [...grouped.values()].map((entry) => {
      // listByDateRange returns newest-first; sort this day's punches oldest→newest.
      const punches = [...entry.punches].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      // Pair consecutive CLOCK_IN → CLOCK_OUT into sessions (Zoho-style). Total
      // working time = SUM of completed session durations. An unpaired trailing
      // CLOCK_IN is an OPEN session (still on shift) and contributes 0 to the
      // recorded total until the matching clock-out arrives.
      const sessions: { clockIn: AttendanceDocument; clockOut: AttendanceDocument | null; hours: number }[] = [];
      let openIn: AttendanceDocument | null = null;
      for (const p of punches) {
        if (p.type === 'CLOCK_IN') {
          // Two INs in a row (shouldn't happen with the guard) – keep the latest.
          openIn = p;
        } else if (p.type === 'CLOCK_OUT' && openIn) {
          const hours = dayjs(p.createdAt).diff(dayjs(openIn.createdAt), 'hour', true);
          sessions.push({ clockIn: openIn, clockOut: p, hours: Math.max(0, hours) });
          openIn = null;
        }
      }
      const hasOpenSession = openIn !== null;
      if (hasOpenSession) {
        sessions.push({ clockIn: openIn!, clockOut: null, hours: 0 });
      }

      const totalHours =
        Math.round(sessions.reduce((sum, s) => sum + s.hours, 0) * 100) / 100;

      // Backward-compatible scalars: first clock-in of the day, last clock-out.
      const clockIn = punches.find((p) => p.type === 'CLOCK_IN') ?? null;
      const clockOut = [...punches].reverse().find((p) => p.type === 'CLOCK_OUT') ?? null;

      // Status uses the FIRST clock-in (lateness) and the overall day's totals.
      const anyPending = punches.some((p) => p.approvalStatus === 'PENDING');
      const anyRejected = punches.some((p) => p.approvalStatus === 'REJECTED');

      let status = 'ABSENT';
      if (exemptionKeys.has(`${(entry.user as unknown as { _id: unknown })._id}_${entry.date}`)) {
        status = 'EXEMPT';
      } else if (clockIn) {
        if (anyPending) {
          status = 'PENDING';
        } else if (anyRejected) {
          status = 'REJECTED';
        } else {
          const clockInTime = dayjs(clockIn.createdAt);
          const userShift =
            (entry.user as unknown as { shiftStartTime?: string })?.shiftStartTime || shiftStart;
          const shiftStartTime = dayjs(`${entry.date}T${userShift}`);
          const lateBy = clockInTime.diff(shiftStartTime, 'minute');

          status =
            lateBy > lateThreshold ? (totalHours < 4 ? 'HALF_DAY' : 'LATE') : 'PRESENT';
        }
      }

      return {
        date: entry.date,
        user: entry.user,
        clockIn,
        clockOut,
        punches,
        sessions: sessions.map((s) => ({
          clockIn: s.clockIn,
          clockOut: s.clockOut,
          hours: Math.round(s.hours * 100) / 100,
        })),
        sessionCount: sessions.length,
        hasOpenSession,
        totalHours,
        status,
      };
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

    // All dashboard inputs are independent – fire them concurrently instead of
    // five serial network round-trips (~0.8s on the remote Supabase cluster).
    const [totalStaff, todayRecords, settings, exemptToday, onLeaveToday] = await Promise.all([
      userRepository.queries.countActiveStaff(),
      attendanceRepository.queries.listClockInsByDate(today),
      settingsRepository.queries.findFirstLean(),
      dayOffRepository.queries.countByDate(today),
      leaveCountForDay(today),
    ]);

    const shiftStart = settings?.shiftStartTime || DEFAULTS.SHIFT_START;
    const lateThreshold = settings?.lateThresholdMinutes || DEFAULTS.LATE_THRESHOLD_MINUTES;

    // Day-offs and approved leaves must NOT count as absent.

    // Approval-gated policy: REJECTED punches are INVALID attendance.
    const validRecords = todayRecords.filter((r) => r.approvalStatus !== 'REJECTED');

    // Multi-session: a person may clock in several times today. De-dupe by user
    // so one staff member counts ONCE, using their EARLIEST clock-in for lateness.
    const firstClockInByUser = new Map<string, AttendanceDocument>();
    for (const record of validRecords) {
      const uid = String((record.user as unknown as { _id?: unknown })?._id ?? record.user);
      const existing = firstClockInByUser.get(uid);
      if (!existing || new Date(record.createdAt).getTime() < new Date(existing.createdAt).getTime()) {
        firstClockInByUser.set(uid, record);
      }
    }

    let late = 0;
    for (const record of firstClockInByUser.values()) {
      const clockInTime = dayjs(record.createdAt);
      const userShift =
        (record.user as unknown as { shiftStartTime?: string })?.shiftStartTime || shiftStart;
      const shiftStartTime = dayjs(`${today}T${userShift}`);
      if (clockInTime.diff(shiftStartTime, 'minute') > lateThreshold) {
        late += 1;
      }
    }

    const presentToday = firstClockInByUser.size;

    return {
      totalStaff,
      presentToday,
      lateToday: late,
      absentToday: Math.max(0, totalStaff - presentToday - exemptToday - onLeaveToday),
      onLeaveToday: onLeaveToday + exemptToday,
    };
  }

  /** Monthly trend data for charts (per-day present/late/absent counts). */
  public async getMonthlyTrend(month: number, year: number): Promise<unknown[]> {
    const startDate = monthStartISO(month, year);
    const endDate = monthEndISO(month, year);

    // Four independent reads fire in parallel: headcount, the month's
    // clock-ins, org settings and exemption rows (~0.5s saved vs. four serial
    // round-trips on the remote cluster).
    const [totalStaff, records, settings, exemptDocs] = await Promise.all([
      userRepository.queries.countActiveStaff(),
      attendanceRepository.queries.listClockInsBetween(startDate, endDate),
      settingsRepository.queries.findFirstLean(),
      dayOffRepository.queries.listDatesInRange(startDate, endDate),
    ]);

    // REJECTED punches are invalid attendance – exclude from trend charts.
    const validRecords = records.filter((r) => r.approvalStatus !== 'REJECTED');

    const shiftStart = settings?.shiftStartTime || DEFAULTS.SHIFT_START;
    const lateThreshold = settings?.lateThresholdMinutes || DEFAULTS.LATE_THRESHOLD_MINUTES;

    // Multi-session: collapse multiple clock-ins per user/day to a single
    // earliest clock-in before counting, so one person == one present/late.
    const firstByUserDate = new Map<string, AttendanceDocument>();
    for (const r of validRecords) {
      const uid = String((r.user as unknown as { _id?: unknown })?._id ?? r.user);
      const key = `${uid}_${r.date}`;
      const existing = firstByUserDate.get(key);
      if (!existing || new Date(r.createdAt).getTime() < new Date(existing.createdAt).getTime()) {
        firstByUserDate.set(key, r);
      }
    }

    // Group by date
    const byDate = new Map<string, { present: number; late: number }>();
    for (const r of firstByUserDate.values()) {
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

    const patch: Partial<IAttendance> = {
      approvalStatus: args.status,
      approvedBy: args.reviewer.id,
    };
    if (args.adminComments !== undefined && args.adminComments !== null) {
      patch.adminComments = args.adminComments;
    }

    const populated =
      (await attendanceRepository.queries.updateById(String(record._id), patch)) ?? record;

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
const leaveCountForDay = (today: string): Promise<number> =>
  leaveRepository.queries.countApprovedOnDate(today);

export const attendanceService = AttendanceService.getInstance();
