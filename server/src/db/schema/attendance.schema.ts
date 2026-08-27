import { boolean, doublePrecision, index, jsonb, pgTable, real, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { users } from './user.schema.js';
import { offices } from './office.schema.js';

/** jsonb shape for the GPS punch location snapshot. */
export interface PunchLocationJson {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  address: string;
  withinGeofence: boolean;
  distanceFromOffice: number;
  branchName: string;
  isCoverDuty: boolean;
}

/** jsonb shape for the VPN/proxy check breakdown. */
export interface VpnCheckDetailsJson {
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  webrtcMismatch: boolean;
  timezoneMismatch: boolean;
}

/**
 * Attendance punches (old Mongo `Attendance` collection).
 * The {user,date,type} unique index is the hard double-punch guard – a
 * duplicate surfaces as a friendly ConflictError in the repository.
 */
export const attendance = pgTable(
  'attendance',
  {
    id: primaryId(),
    user: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    punchedOffice: uuid('punched_office').references(() => offices.id, { onDelete: 'set null' }),
    isCoverDuty: boolean('is_cover_duty').notNull().default(false),
    type: text('type').notNull(), // CLOCK_IN | CLOCK_OUT
    selfieUrl: text('selfie_url').notNull(),
    location: jsonb('location').$type<PunchLocationJson>().notNull(),
    ipAddress: text('ip_address').notNull().default(''),
    vpnDetected: boolean('vpn_detected').notNull().default(false),
    vpnCheckDetails: jsonb('vpn_check_details').$type<VpnCheckDetailsJson | null>(),
    browserTimezone: text('browser_timezone').notNull().default(''),
    date: text('date').notNull(), // YYYY-MM-DD
    approvalStatus: text('approval_status').notNull().default('PENDING'),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    adminComments: text('admin_comments'),
    faceMatched: boolean('face_matched'),
    faceMatchScore: real('face_match_score'),
    ...timestamps,
  },
  (t) => ({
    userDateTypeUnique: uniqueIndex('attendance_user_date_type_unique').on(t.user, t.date, t.type),
    dateIdx: index('attendance_date_idx').on(t.date),
  }),
);

export type AttendanceRow = typeof attendance.$inferSelect;
export type NewAttendanceRow = typeof attendance.$inferInsert;
