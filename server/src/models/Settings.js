import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  organizationName: { type: String, default: 'EdgeAttendance' },
  officeLatitude: { type: Number, default: 28.6139 },
  officeLongitude: { type: Number, default: 77.2090 },
  officeName: { type: String, default: 'Head Office' },
  geofenceRadius: { type: Number, default: 200 }, // meters
  shiftStartTime: { type: String, default: '09:00' },
  shiftEndTime: { type: String, default: '18:00' },
  lateThresholdMinutes: { type: Number, default: 15 },
  workingDays: { type: [String], default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
  // false → VPN flags are advisory: punch succeeds but is flagged for admin review.
  // true  → VPN blocks the punch outright.
  vpnStrictMode: { type: Boolean, default: false },
  // ── Review automation ──────────────────────────────────────────────────────
  // PENDING regularizations older than N days are auto-APPROVED by a daily
  // sweep so the approval queue never silts up. 0 = disabled (default).
  regularizationAutoApproveDays: { type: Number, default: 0 },
  // ── Attendance auto-approval ────────────────────────────────────────────────
  // true  → clean punches (inside geofence + face verified + no VPN/device flag)
  //         are APPROVED automatically; admins only review genuine anomalies.
  // false → every punch lands as PENDING for explicit admin approval.
  autoApproveAttendance: { type: Boolean, default: true },
  // ── Email notification master switches ────────────────────────────────────
  // Security-critical mails (password reset) are ALWAYS sent regardless.
  emailNotifications: {
    userUpdates: { type: Boolean, default: true }, // decisions / duty / day-off / welcome / profile mails
    broadcasts: { type: Boolean, default: true },  // admin announcements to all staff
    adminAlerts: { type: Boolean, default: true }, // signup requests + site/holiday/settings alerts
  },
  // ── Leave accrual policy (Indian standard) ────────────────────────────────
  // CL → credits EVERY month · SL → granted UPFRONT each year (use-it-or-lose)
  // EL → credited EVERY year. Admin-editable from Settings → Leave Policy.
  leavePolicy: {
    casualPerMonth: { type: Number, default: 1 },
    sickAnnual: { type: Number, default: 6 },
    earnedAnnual: { type: Number, default: 12 },
  },
  // Accrual bookkeeping – idempotency markers so server restarts can NEVER
  // double-credit a month/year.
  accrualState: {
    lastMonthlyCL: { type: String, default: '' }, // 'YYYY-MM' already credited
    lastAnnualSL: { type: String, default: '' },  // 'YYYY' already renewed
    lastAnnualEL: { type: String, default: '' },  // 'YYYY' already credited
  },
  // ── Email identity – ADMIN CONTROLS how every outgoing email signs itself ──
  mailFromName: { type: String, default: 'EdgeAttendance Admin' },
  mailFromAddress: { type: String, default: '' }, // empty → falls back to SMTP_EMAIL
}, { timestamps: true });

export default mongoose.model('Settings', settingsSchema);
