/**
 * ────────────────────────────────────────────────────────────────────────────
 * APPLICATION-WIDE CONSTANTS
 * ────────────────────────────────────────────────────────────────────────────
 * Single source of truth for every enum-ish value shared across modules.
 * Mongoose schemas import the arrays; services/resolvers import the unions.
 */

export const ROLES = ['STAFF', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const PUNCH_TYPES = ['CLOCK_IN', 'CLOCK_OUT'] as const;
export type PunchType = (typeof PUNCH_TYPES)[number];

export const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const LEAVE_TYPES = ['CASUAL', 'SICK', 'EARNED'] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const HOLIDAY_TYPES = ['NATIONAL', 'OPTIONAL'] as const;
export type HolidayType = (typeof HOLIDAY_TYPES)[number];

/** Derived daily attendance status shown on dashboards/history. */
export const ATTENDANCE_SUMMARY_STATUSES = [
  'PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'HOLIDAY', 'EXEMPT', 'PENDING', 'REJECTED',
] as const;
export type AttendanceSummaryStatus = (typeof ATTENDANCE_SUMMARY_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'LEAVE_REQUEST',
  'LEAVE_DECISION',
  'REGULARIZATION_REQUEST',
  'REGULARIZATION_DECISION',
  'ATTENDANCE_FLAGGED',
  'ATTENDANCE_DECISION',
  'SIGNUP_REQUEST',
  'SIGNUP_DECISION',
  'TEMP_DUTY',
  'DAY_OFF',
  'MEDICINE_REQUEST',
  'MEDICINE_DECISION',
  'PUNCH_REMINDER',
  'ABSENT_ALERT',
  'DOCUMENT_UPLOADED',
  'DOCUMENT_DECISION',
  'DOCUMENT_REQUESTED',
  'GENERIC',
  'ANNOUNCEMENT',
] as const;
export type NotificationTypeUnion = (typeof NOTIFICATION_TYPES)[number];

export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const LOGIN_METHODS = ['PASSWORD', 'GOOGLE'] as const;
export type LoginMethod = (typeof LOGIN_METHODS)[number];

export const DOCUMENT_CATEGORIES = ['ID_PROOF', 'CERTIFICATE', 'OTHER'] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const MEDICINE_UNITS = ['Strips', 'Bottles', 'Units', 'Boxes'] as const;
export type MedicineUnit = (typeof MEDICINE_UNITS)[number];

export const MEDICINE_URGENCIES = ['LOW', 'NORMAL', 'URGENT'] as const;
export type MedicineUrgency = (typeof MEDICINE_URGENCIES)[number];

export const MEDICINE_STATUSES = ['PENDING', 'ORDERED', 'SUPPLIED', 'REJECTED'] as const;

/**
 * Pharmacy-grade medicine master vocabulary (aligned with Indian retail
 * pharmacy software & the Drugs & Cosmetics Act 1940 schedules).
 */
export const MEDICINE_DOSAGE_FORMS = [
  'Tablet', 'Capsule', 'Syrup', 'Suspension', 'Drops', 'Injection',
  'Cream / Ointment / Gel', 'Inhaler', 'Sachet / Powder', 'Lozenges', 'Other',
] as const;

/** Schedule H / H1 / X need a prescription; OTC is sold over the counter. */
export const MEDICINE_SCHEDULES = [
  { value: 'OTC', label: 'OTC (No prescription)' },
  { value: 'H', label: 'Schedule H (Rx)' },
  { value: 'H1', label: 'Schedule H1 (Rx + register)' },
  { value: 'X', label: 'Schedule X (Rx retained)' },
] as const;

export const MEDICINE_CATEGORIES = [
  'Analgesic / Antipyretic', 'Antibiotic', 'Antacid / GI', 'Antiallergic',
  'Antihypertensive', 'Antidiabetic', 'Multivitamin / Supplement',
  'Respiratory / Cough & Cold', 'Skin / Dermatology', 'Other',
] as const;

/** Indian medicine GST slabs (HSN 3004): 0% / 5% / 12%. */
export const MEDICINE_GST_RATES = [0, 5, 12] as const;

/** PubSub channels – one place so publishers/subscribers never drift apart. */
export const PUBSUB_CHANNELS = {
  LEAVE_REQUEST_ADDED: 'LEAVE_REQUEST_ADDED',
  LEAVE_REQUEST_UPDATED: 'LEAVE_REQUEST_UPDATED',
  REGULARIZATION_ADDED: 'REGULARIZATION_ADDED',
  REGULARIZATION_UPDATED: 'REGULARIZATION_UPDATED',
  NOTIFICATION_ADDED: 'NOTIFICATION_ADDED',
} as const;

/** Approval statuses that never include CANCELLED (users, attendance, regularization). */
export const REVIEWABLE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ReviewableStatus = (typeof REVIEWABLE_STATUSES)[number];

/** Domain defaults used when Settings document is missing a field. */
export const DEFAULTS = {
  SHIFT_START: '09:00',
  SHIFT_END: '18:00',
  LATE_THRESHOLD_MINUTES: 15,
  GEOFENCE_RADIUS_METERS: 200,
  ORGANIZATION_NAME: 'EdgeAttendance',
  /** Absence alert fires this many minutes after shift start (09:00 → 10:30). */
  ABSENT_ALERT_OFFSET_MINUTES: 90,
} as const;
