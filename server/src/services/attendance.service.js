import dayjs from 'dayjs';
import Attendance from '../models/Attendance.js';
import Settings from '../models/Settings.js';
import Exemption from '../models/Exemption.js';
import LeaveRequest from '../models/LeaveRequest.js';
import { checkGeofence } from '../utils/geofence.js';
import { checkVPN, checkWebRTCMismatch, checkTimezoneMismatch } from '../utils/vpnDetector.js';
import { saveBase64Image } from '../utils/fileUpload.js';
import { ValidationError, VPNDetectedError, GeofenceError } from '../utils/errors.js';
import { notifyAdmins } from './notification.service.js';

/**
 * Process a clock-in or clock-out request
 */
export const processAttendance = async ({ userId, type, input, ipAddress }) => {
  const today = dayjs().format('YYYY-MM-DD');
  
  // Check for duplicate punch
  const existingPunch = await Attendance.findOne({ user: userId, date: today, type });
  if (existingPunch) {
    throw ValidationError(`Already ${type === 'CLOCK_IN' ? 'clocked in' : 'clocked out'} today`);
  }
  
  // For clock-out, ensure clock-in exists
  if (type === 'CLOCK_OUT') {
    const clockIn = await Attendance.findOne({ user: userId, date: today, type: 'CLOCK_IN' });
    if (!clockIn) throw ValidationError('Cannot clock out without clocking in first');
  }
  
  // Layer 1: GPS Accuracy Check (500m for desktop Wi-Fi, mobile GPS is usually < 50m)
  if (input.accuracy > 500) {
    throw ValidationError('Location accuracy too low. Please enable GPS/Wi-Fi on your device.');
  }
  
  // Org settings loaded once up front – drives VPN policy & geofence fallbacks
  const settings = await Settings.findOne();

  // Layer 2: VPN Detection via API (already fail-open on API/network errors)
  const vpnResult = await checkVPN(ipAddress);
  
  // Layer 3: WebRTC IP Mismatch
  const webrtcMismatch = checkWebRTCMismatch(ipAddress, input.webRTCIPs || []);
  
  // Layer 4: Timezone Mismatch
  const timezoneMismatch = checkTimezoneMismatch(input.browserTimezone, vpnResult.ipTimezone);
  
  const vpnDetected = vpnResult.isVPN || webrtcMismatch;
  
  /**
   * VPN POLICY (configurable from Admin → Settings):
   *  - strict mode ON   → punch blocked outright (previous behaviour)
   *  - strict mode OFF  → punch SUCCEEDS but the record is flagged PENDING for
   *    admin review. Fixes false positives (ISP-grade NAT, mobile carriers,
   *    corporate firewalls) that made attendance permanently fail.
   */
  if (vpnDetected && settings?.vpnStrictMode) {
    throw VPNDetectedError('VPN or Proxy detected. Please disable VPN to mark attendance.');
  }
  
  // Multi-Store Geofence & Branch Rotation Check
  const { default: User } = await import('../models/User.js');
  const { default: Office } = await import('../models/Office.js');
  
  const user = await User.findById(userId).populate('assignedOffice');
  const allActiveOffices = await Office.find({ isActive: true });
  
  let withinGeofence = false;
  let distance = 0;
  let punchedOffice = null;
  let isCoverDuty = false;
  let branchName = 'Head Office';
  let nearestDistance = Infinity;
  let nearestOfficeName = 'Designated Store';

  // Resolve the EFFECTIVE site: an active TEMP DUTY assignment wins over the
  // permanent one; expired temp assignments are ignored automatically.
  let effectiveOffice = user?.assignedOffice || null;
  const ta = user?.temporaryAssignment;
  if (ta?.office) {
    const todayStart = dayjs(today).startOf('day');
    const taStart = dayjs(ta.startDate).startOf('day');
    const taEnd = dayjs(ta.endDate).endOf('day');
    const isActiveNow = !todayStart.isBefore(taStart) && !todayStart.isAfter(taEnd);

    if (isActiveNow) {
      effectiveOffice =
        allActiveOffices.find((o) => ta.office && o._id.toString() === ta.office.toString()) ||
        (await Office.findById(ta.office)) ||
        effectiveOffice;
    }
  }

  let permanentOfficeId = user?.assignedOffice?._id?.toString() || null;

  // 1. Check effective office first (temp duty overrides permanent assignment)
  if (effectiveOffice) {
    const assignedCoords = {
      latitude: effectiveOffice.latitude,
      longitude: effectiveOffice.longitude,
    };
    const radius = effectiveOffice.geofenceRadius || 200;
    const res = checkGeofence({ latitude: input.latitude, longitude: input.longitude }, assignedCoords, radius);
    
    if (res.withinGeofence) {
      withinGeofence = true;
      distance = res.distance;
      punchedOffice = effectiveOffice._id;
      isCoverDuty = false;
      branchName = effectiveOffice.name;
    } else {
      nearestDistance = res.distance;
      nearestOfficeName = effectiveOffice.name;
    }
  }

  // 2. If not at assigned office, check all other active store branches (Dynamic Store Rotation / Cover Duty)
  if (!withinGeofence && allActiveOffices.length > 0) {
    for (const office of allActiveOffices) {
      const officeCoords = { latitude: office.latitude, longitude: office.longitude };
      const radius = office.geofenceRadius || 200;
      const res = checkGeofence({ latitude: input.latitude, longitude: input.longitude }, officeCoords, radius);

      if (res.distance < nearestDistance) {
        nearestDistance = res.distance;
        nearestOfficeName = office.name;
      }

      if (res.withinGeofence) {
        withinGeofence = true;
        distance = res.distance;
        punchedOffice = office._id;
        isCoverDuty = permanentOfficeId ? permanentOfficeId !== office._id.toString() : false;
        branchName = office.name;
        break;
      }
    }
  }

  // 3. Fallback to global settings if no offices exist
  if (!withinGeofence && allActiveOffices.length === 0 && !effectiveOffice) {
    const officeCoords = {
      latitude: settings?.officeLatitude || 28.6139,
      longitude: settings?.officeLongitude || 77.2090,
    };
    const radius = settings?.geofenceRadius || 200;
    const res = checkGeofence({ latitude: input.latitude, longitude: input.longitude }, officeCoords, radius);
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
    throw GeofenceError(`You are ${nearestDistance}m away from the nearest store (${nearestOfficeName}). You must be inside an authorized homeopathic store.`);
  }
  
  // Save selfie image
  const timestamp = Date.now();
  const filename = `${userId}_${type.toLowerCase()}_${today}_${timestamp}`;
  const selfieUrl = saveBase64Image(input.selfieBase64, filename);
  
  // Create attendance record
  // ── APPROVAL POLICY (how modern HRMS platforms behave) ──────────────────────
  // A CLEAN punch (inside geofence + face verified + no VPN/device flag) is
  // auto-APPROVED, so admins only review genuine anomalies. Anything suspicious
  // stays PENDING and lands in the admin inbox with the reason attached.
  const hasIdentityFlag = vpnDetected || input.faceMatched === false;
  const faceVerified = input.faceMatched === true;
  const autoApproved =
    !hasIdentityFlag && faceVerified && settings?.autoApproveAttendance !== false;

  const attendance = new Attendance({
    user: userId,
    punchedOffice,
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
    ipAddress,
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
    // Flagged punches carry the reason so the reviewer sees WHY instantly:
    //   - VPN/proxy or device mismatch
    //   - Face did not match the registered profile photo
    ...(hasIdentityFlag
      ? {
          adminComments: vpnDetected
            ? 'Auto-flagged: possible VPN/proxy or device mismatch'
            : 'Auto-flagged: face did not match registered profile photo',
        }
      : {}),
  });
  
  await attendance.save();
  await attendance.populate('user');

  if (vpnDetected || input.faceMatched === false) {
    await notifyAdmins({
      type: 'ATTENDANCE_FLAGGED',
      title: 'Flagged punch needs review',
      message: `${attendance.user?.name || 'A staff member'} punched ${type === 'CLOCK_IN' ? 'IN' : 'OUT'} at ${branchName}${vpnDetected ? ', but a VPN/proxy or device mismatch was detected' : ', but the face did NOT match their registered profile photo'}.`,
      link: `/approvals?focus=${attendance._id}#attendance`,
      pill: { label: 'SECURITY FLAG', tone: 'error' },
      rows: [
        ['Employee', attendance.user?.name || 'A staff member'],
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
};

/**
 * Get attendance summary for a date range
 */
export const getAttendanceSummary = async ({ userId, startDate, endDate, allUsers = false }) => {
  const settings = await Settings.findOne();
  const lateThreshold = settings?.lateThresholdMinutes || 15;
  const shiftStart = settings?.shiftStartTime || '09:00';
  
  const query = {};
  if (!allUsers && userId) query.user = userId;
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = startDate;
    if (endDate) query.date.$lte = endDate;
  }
  
  const records = await Attendance.find(query)
    .populate('user')
    .sort({ date: -1, createdAt: -1 });
  
  // Day-off exemptions in range → shown as EXEMPT rows even without punches
  const exemptQuery = {};
  if (!allUsers && userId) exemptQuery.user = userId;
  if (startDate || endDate) {
    exemptQuery.date = {};
    if (startDate) exemptQuery.date.$gte = startDate;
    if (endDate) exemptQuery.date.$lte = endDate;
  }
  const exemptions = await Exemption.find(exemptQuery).populate('user');
  
  // Group by user + date
  const grouped = {};
  for (const record of records) {
    const key = `${record.user._id}_${record.date}`;
    if (!grouped[key]) {
      grouped[key] = { date: record.date, user: record.user, clockIn: null, clockOut: null };
    }
    if (record.type === 'CLOCK_IN') grouped[key].clockIn = record;
    if (record.type === 'CLOCK_OUT') grouped[key].clockOut = record;
  }

  // Inject day-off rows so admins/staff see WHY no punch exists that day
  for (const exemption of exemptions) {
    if (!exemption.user) continue;
    const key = `${exemption.user._id}_${exemption.date}`;
    if (!grouped[key]) {
      grouped[key] = { date: exemption.date, user: exemption.user, clockIn: null, clockOut: null };
    }
  }

  const exemptionKeys = new Set(exemptions.map((e) => `${e.user?._id || e.user}_${e.date}`));

  
  return Object.values(grouped).map(entry => {
    let totalHours = 0;
    if (entry.clockIn && entry.clockOut) {
      totalHours = dayjs(entry.clockOut.createdAt).diff(dayjs(entry.clockIn.createdAt), 'hour', true);
      totalHours = Math.round(totalHours * 100) / 100;
    }
    
    let status = 'ABSENT';
    if (exemptionKeys.has(`${entry.user._id}_${entry.date}`)) {
      status = 'EXEMPT';
        } else if (entry.clockIn) {
      if (entry.clockIn.approvalStatus === 'PENDING' || entry.clockOut?.approvalStatus === 'PENDING') {
        status = 'PENDING';
      } else if (entry.clockIn.approvalStatus === 'REJECTED' || entry.clockOut?.approvalStatus === 'REJECTED') {
        status = 'REJECTED';
      } else {
        const clockInTime = dayjs(entry.clockIn.createdAt);
        const userShift = entry.user?.shiftStartTime || shiftStart;
        const shiftStartTime = dayjs(entry.date + 'T' + userShift);
        const lateBy = clockInTime.diff(shiftStartTime, 'minute');
        
        if (lateBy > lateThreshold) {
          status = totalHours < 4 ? 'HALF_DAY' : 'LATE';
        } else {
          status = 'PRESENT';
        }
      }
    }

    return { ...entry, totalHours, status };
  });
};

/**
 * Get today's dashboard stats
 */
export const getDashboardStats = async () => {
  const today = dayjs().format('YYYY-MM-DD');
  const { default: User } = await import('../models/User.js');
  
  const totalStaff = await User.countDocuments({ role: 'STAFF', isActive: true });
  const todayRecords = await Attendance.find({ date: today, type: 'CLOCK_IN' }).populate('user');
  
  const settings = await Settings.findOne();
  const shiftStart = settings?.shiftStartTime || '09:00';
  const lateThreshold = settings?.lateThresholdMinutes || 15;
  
  // Day-offs and approved leaves must NOT count as absent
  const [exemptToday, onLeaveToday] = await Promise.all([
    Exemption.countDocuments({ date: today }),
    LeaveRequest.countDocuments({
      status: 'APPROVED',
      startDate: { $lte: today },
      endDate: { $gte: today },
    }),
  ]);
  
  let late = 0;
  
  // Approval-gated policy: REJECTED punches are INVALID attendance – they must
  // not inflate presence/lateness numbers on the dashboard.
  const validRecords = todayRecords.filter((r) => r.approvalStatus !== 'REJECTED');

  for (const record of validRecords) {
    const clockInTime = dayjs(record.createdAt);
    const userShift = record.user?.shiftStartTime || shiftStart;
    const shiftStartTime = dayjs(today + 'T' + userShift);
    if (clockInTime.diff(shiftStartTime, 'minute') > lateThreshold) {
      late++;
    }
  }
  
  return {
    totalStaff,
    presentToday: validRecords.length,
    lateToday: late,
    absentToday: Math.max(0, totalStaff - validRecords.length - exemptToday - onLeaveToday),
    onLeaveToday: onLeaveToday + exemptToday,
  };
};

/**
 * Get monthly trend data for charts
 */
export const getMonthlyTrend = async (month, year) => {
  const { default: User } = await import('../models/User.js');
  const totalStaff = await User.countDocuments({ role: 'STAFF', isActive: true });
  
  const startDate = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('YYYY-MM-DD');
  const endDate = dayjs(startDate).endOf('month').format('YYYY-MM-DD');
  
  const records = await Attendance.find({
    date: { $gte: startDate, $lte: endDate },
    type: 'CLOCK_IN',
  }).populate('user');

  // REJECTED punches are invalid attendance – exclude from trend charts
  const validRecords = records.filter((r) => r.approvalStatus !== 'REJECTED');
  
  const settings = await Settings.findOne();
  const shiftStart = settings?.shiftStartTime || '09:00';
  const lateThreshold = settings?.lateThresholdMinutes || 15;
  
  // Group by date
  const byDate = {};
  for (const r of validRecords) {
    if (!byDate[r.date]) byDate[r.date] = { present: 0, late: 0 };
    const clockInTime = dayjs(r.createdAt);
    const userShift = r.user?.shiftStartTime || shiftStart;
      const shiftStartTime = dayjs(r.date + 'T' + userShift);
    if (clockInTime.diff(shiftStartTime, 'minute') > lateThreshold) {
      byDate[r.date].late++;
    } else {
      byDate[r.date].present++;
    }
  }
  
  const daysInMonth = dayjs(startDate).daysInMonth();
  
  // Exempted staff-days reduce the "absent" bar in the monthly trend
  const exemptDocs = await Exemption.find({ date: { $gte: startDate, $lte: endDate } }).select('date');
  const exemptCountByDate = {};
  for (const e of exemptDocs) {
    exemptCountByDate[e.date] = (exemptCountByDate[e.date] || 0) + 1;
  }
  
  const trend = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = dayjs(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`).format('YYYY-MM-DD');
    const data = byDate[date] || { present: 0, late: 0 };
    const exemptCount = exemptCountByDate[date] || 0;
    trend.push({
      date,
      presentCount: data.present,
      lateCount: data.late,
      absentCount: Math.max(0, totalStaff - data.present - data.late - exemptCount),
    });
  }
  
  return trend;
};
