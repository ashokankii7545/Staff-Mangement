import { sql } from 'drizzle-orm';
import { boolean, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { offices } from './office.schema.js';

/** jsonb shape for temporaryAssignment (office is a uuid string, not ObjectId). */
export interface TempAssignmentJson {
  office: string | null;
  startDate: string | null; // ISO date string
  endDate: string | null;
  reason: string;
}

/** jsonb shape for leaveBalances. */
export interface LeaveBalancesJson {
  casual: number;
  sick: number;
  earned: number;
}

/**
 * Users – the identity + profile table (old Mongo `User` collection).
 * Auth (JWT/Google/bcrypt) is UNCHANGED; it just reads/writes this table.
 *
 * Nested Mongo subdocuments become jsonb:
 *  - temporaryAssignment { office, startDate, endDate, reason }
 *  - leaveBalances { casual, sick, earned }
 * Array fields become Postgres arrays (restrictedPages text[], faceEmbedding real[]).
 */
export const users = pgTable(
  'users',
  {
    id: primaryId(),
    employeeId: text('employee_id').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    /** bcrypt hash – nullable for Google-only accounts. */
    password: text('password'),
    role: text('role').notNull().default('STAFF'),
    department: text('department').notNull().default('General'),
    assignedOffice: uuid('assigned_office').references(() => offices.id, { onDelete: 'set null' }),
    avatar: text('avatar').notNull().default(''),
    isActive: boolean('is_active').notNull().default(true),
    approvalStatus: text('approval_status').notNull().default('APPROVED'),
    approvalNote: text('approval_note').notNull().default(''),
    themePreference: text('theme_preference').notNull().default('system'),
    restrictedPages: text('restricted_pages').array().notNull().default(sql`'{}'::text[]`),
    googleId: text('google_id').notNull().default(''),
    loginMethod: text('login_method').notNull().default('PASSWORD'),
    emailVerified: boolean('email_verified').notNull().default(false),
    verificationOtp: text('verification_otp'),
    verificationOtpExpiry: timestamp('verification_otp_expiry', { withTimezone: true }),
    temporaryAssignment: jsonb('temporary_assignment').$type<TempAssignmentJson | null>(),
    leaveBalances: jsonb('leave_balances')
      .$type<LeaveBalancesJson>()
      .notNull()
      .default({ casual: 12, sick: 6, earned: 0 }),
    faceEmbedding: real('face_embedding').array().notNull().default(sql`'{}'::real[]`),
    shiftStartTime: text('shift_start_time').notNull().default(''),
    shiftEndTime: text('shift_end_time').notNull().default(''),
    ...timestamps,
  },
  (t) => ({
    emailUnique: uniqueIndex('users_email_unique').on(t.email),
    employeeIdUnique: uniqueIndex('users_employee_id_unique').on(t.employeeId),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
