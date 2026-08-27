import mongoose, { Schema, type Model } from 'mongoose';
import { DEFAULTS, THEME_PREFERENCES } from '../../config/constants.js';

export interface IEmailNotificationPrefs {
  userUpdates: boolean;
  broadcasts: boolean;
  adminAlerts: boolean;
}

export interface ILeavePolicy {
  casualPerMonth: number;
  sickAnnual: number;
  earnedAnnual: number;
}

/** Idempotency markers so server restarts can never double-credit leave. */
export interface IAccrualState {
  lastMonthlyCL: string; // 'YYYY-MM' already credited
  lastAnnualSL: string;  // 'YYYY' already renewed
  lastAnnualEL: string;  // 'YYYY' already credited
}

export interface ISettings {
  organizationName: string;
  appLogo?: string;
  officeLatitude: number;
  officeLongitude: number;
  officeName: string;
  geofenceRadius: number;
  shiftStartTime: string;
  shiftEndTime: string;
  lateThresholdMinutes: number;
  workingDays: string[];
  vpnStrictMode: boolean;
  regularizationAutoApproveDays: number;
  autoApproveAttendance: boolean;
  emailNotifications: IEmailNotificationPrefs;
  leavePolicy: ILeavePolicy;
  accrualState: IAccrualState;
  mailFromName: string;
  mailFromAddress: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SettingsDocument = mongoose.HydratedDocument<ISettings>;

const settingsSchema = new Schema<ISettings>(
  {
    organizationName: { type: String, default: DEFAULTS.ORGANIZATION_NAME },
    appLogo: { type: String, default: null },
    officeLatitude: { type: Number, default: 28.6139 },
    officeLongitude: { type: Number, default: 77.209 },
    officeName: { type: String, default: 'Head Office' },
    geofenceRadius: { type: Number, default: DEFAULTS.GEOFENCE_RADIUS_METERS }, // meters
    shiftStartTime: { type: String, default: DEFAULTS.SHIFT_START },
    shiftEndTime: { type: String, default: DEFAULTS.SHIFT_END },
    lateThresholdMinutes: { type: Number, default: DEFAULTS.LATE_THRESHOLD_MINUTES },
    workingDays: {
      type: [String],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    // false → VPN flags are advisory (flagged for review); true → punch blocked.
    vpnStrictMode: { type: Boolean, default: false },
    // PENDING regularizations older than N days auto-APPROVE daily. 0 = off.
    regularizationAutoApproveDays: { type: Number, default: 0 },
    // true → clean punches auto-APPROVE; admins review only anomalies.
    autoApproveAttendance: { type: Boolean, default: true },
    // Security-critical mails (password reset) are ALWAYS sent regardless.
    emailNotifications: {
      userUpdates: { type: Boolean, default: true },
      broadcasts: { type: Boolean, default: true },
      adminAlerts: { type: Boolean, default: true },
    },
    // Indian-standard accrual policy: CL monthly · SL annual upfront · EL annual
    leavePolicy: {
      casualPerMonth: { type: Number, default: 1 },
      sickAnnual: { type: Number, default: 6 },
      earnedAnnual: { type: Number, default: 12 },
    },
    accrualState: {
      lastMonthlyCL: { type: String, default: '' },
      lastAnnualSL: { type: String, default: '' },
      lastAnnualEL: { type: String, default: '' },
    },
    mailFromName: { type: String, default: `${DEFAULTS.ORGANIZATION_NAME} Admin` },
    mailFromAddress: { type: String, default: '' }, // empty → falls back to SMTP_EMAIL
  },
  { timestamps: true },
);

export const SettingsModel: Model<ISettings> =
  (mongoose.models.Settings as Model<ISettings>) ||
  mongoose.model<ISettings>('Settings', settingsSchema);
