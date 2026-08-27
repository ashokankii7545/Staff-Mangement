import { boolean, doublePrecision, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { primaryId, timestamps } from './_shared.js';
import { DEFAULTS } from '../../config/constants.js';

/** jsonb shapes for the settings sub-objects. */
export interface EmailNotificationPrefsJson {
  userUpdates: boolean;
  broadcasts: boolean;
  adminAlerts: boolean;
}
export interface LeavePolicyJson {
  casualPerMonth: number;
  sickAnnual: number;
  earnedAnnual: number;
}
export interface AccrualStateJson {
  lastMonthlyCL: string;
  lastAnnualSL: string;
  lastAnnualEL: string;
}

/**
 * Global settings – single-row table (old Mongo `Settings` collection).
 * Nested prefs/policy/accrual markers are jsonb.
 */
export const settings = pgTable('settings', {
  id: primaryId(),
  organizationName: text('organization_name').notNull().default(DEFAULTS.ORGANIZATION_NAME),
  officeLatitude: doublePrecision('office_latitude').notNull().default(28.6139),
  officeLongitude: doublePrecision('office_longitude').notNull().default(77.209),
  officeName: text('office_name').notNull().default('Head Office'),
  geofenceRadius: integer('geofence_radius').notNull().default(DEFAULTS.GEOFENCE_RADIUS_METERS),
  shiftStartTime: text('shift_start_time').notNull().default(DEFAULTS.SHIFT_START),
  shiftEndTime: text('shift_end_time').notNull().default(DEFAULTS.SHIFT_END),
  lateThresholdMinutes: integer('late_threshold_minutes')
    .notNull()
    .default(DEFAULTS.LATE_THRESHOLD_MINUTES),
  workingDays: text('working_days')
    .array()
    .notNull()
    .default(sql`'{Monday,Tuesday,Wednesday,Thursday,Friday}'::text[]`),
  vpnStrictMode: boolean('vpn_strict_mode').notNull().default(false),
  regularizationAutoApproveDays: integer('regularization_auto_approve_days').notNull().default(0),
  autoApproveAttendance: boolean('auto_approve_attendance').notNull().default(true),
  emailNotifications: jsonb('email_notifications')
    .$type<EmailNotificationPrefsJson>()
    .notNull()
    .default({ userUpdates: true, broadcasts: true, adminAlerts: true }),
  leavePolicy: jsonb('leave_policy')
    .$type<LeavePolicyJson>()
    .notNull()
    .default({ casualPerMonth: 1, sickAnnual: 6, earnedAnnual: 12 }),
  accrualState: jsonb('accrual_state')
    .$type<AccrualStateJson>()
    .notNull()
    .default({ lastMonthlyCL: '', lastAnnualSL: '', lastAnnualEL: '' }),
  mailFromName: text('mail_from_name').notNull().default(`${DEFAULTS.ORGANIZATION_NAME} Admin`),
  mailFromAddress: text('mail_from_address').notNull().default(''),
  ...timestamps,
});

export type SettingsRow = typeof settings.$inferSelect;
export type NewSettingsRow = typeof settings.$inferInsert;
