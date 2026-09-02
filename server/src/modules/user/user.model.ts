import type { WithId } from '../../shared/repository/base-repository.js';
import type { PasskeyJson, UserRow } from '../../db/schema/user.schema.js';
import type {
  APPROVAL_STATUSES,
  LOGIN_METHODS,
  REVIEWABLE_STATUSES,
  ROLES,
  THEME_PREFERENCES,
} from '../../config/constants.js';

/**
 * User types – now backed by Postgres/Drizzle (not Mongoose).
 * Password hashing + comparison have moved to the repository/service layer
 * (see user.repository.ts create/update + verifyPassword in password.util.ts).
 */

/** Embedded temporary-duty assignment (jsonb column). office is a uuid string. */
export interface ITempAssignment {
  office: string | null;
  startDate: string | null;
  endDate: string | null;
  reason: string;
}

export interface ILeaveBalances {
  casual: number;
  sick: number;
  earned: number;
}

/** Plain data shape of a User (column-level). */
export interface IUser {
  employeeId: string;
  name: string;
  email: string;
  password?: string | null;
  role: (typeof ROLES)[number] | string;
  department: string;
  assignedOffice: string | null;
  avatar: string;
  isActive: boolean;
  approvalStatus: (typeof REVIEWABLE_STATUSES)[number];
  approvalNote: string;
  themePreference: (typeof THEME_PREFERENCES)[number];
  restrictedPages: string[];
  googleId: string;
  loginMethod: (typeof LOGIN_METHODS)[number];
  emailVerified?: boolean;
  verificationOtp?: string | null;
  verificationOtpExpiry?: Date | null;
  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
  temporaryAssignment?: ITempAssignment | null;
  leaveBalances?: ILeaveBalances;
  faceEmbedding?: number[];
  /** WebAuthn passkeys (public keys only) – fingerprint/Face-ID/PIN credentials. */
  passkeys?: PasskeyJson[];
  /** Last "register your fingerprint" reminder email timestamp (daily dedupe). */
  lastFingerprintReminderAt?: Date | null;
  shiftStartTime: string;
  shiftEndTime: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Hydrated user row as returned by the repository (id + _id + columns).
 * When `assignedOffice`/`temporaryAssignment.office` are "populated" by the
 * resolver/DataLoader, those fields may carry a nested office object instead
 * of a uuid string – hence the loose typing on those paths downstream.
 */
export type IUserDocument = WithId<UserRow>;

/** APPROVAL_STATUSES kept for external references that imported it here. */
export type { APPROVAL_STATUSES };
