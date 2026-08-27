import bcrypt from 'bcryptjs';
import mongoose, { Schema, type HydratedDocument, type Model } from 'mongoose';
import {
  APPROVAL_STATUSES,
  LOGIN_METHODS,
  REVIEWABLE_STATUSES,
  ROLES,
  THEME_PREFERENCES,
} from '../../config/constants.js';
import { comparePasswords, hashPassword } from '../../shared/utils/password.util.js';

/** Embedded temporary-duty assignment (overrides assignedOffice between dates). */
export interface ITempAssignment {
  office: mongoose.Types.ObjectId | null;
  startDate: Date | null;
  endDate: Date | null;
  reason: string;
}

export interface ILeaveBalances {
  casual: number;
  sick: number;
  earned: number;
}

/** Plain data shape of a User document (no methods). */
export interface IUser {
  employeeId: string;
  name: string;
  email: string;
  password?: string;
  role: (typeof ROLES)[number];
  department: string;
  assignedOffice: mongoose.Types.ObjectId | null;
  avatar: string;
  isActive: boolean;
  approvalStatus: (typeof REVIEWABLE_STATUSES)[number];
  approvalNote: string;
  themePreference: (typeof THEME_PREFERENCES)[number];
  /** Route keys this account may NOT open. Empty = full access. */
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
  shiftStartTime: string;
  shiftEndTime: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserInstanceMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export type UserModelType = Model<IUser, object, UserInstanceMethods>;

/** Hydrated document incl. methods & _id typing. */
export type IUserDocument = HydratedDocument<IUser, UserInstanceMethods>;

const tempAssignmentSchema = new Schema<ITempAssignment>(
  {
    office: { type: Schema.Types.ObjectId, ref: 'Office', default: null },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    reason: { type: String, default: '' },
  },
  { _id: false },
);

const userSchema = new Schema<IUser, UserModelType, UserInstanceMethods>(
  {
    employeeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, minlength: 6 },
    role: { type: String, enum: [...ROLES], default: 'STAFF' },
    department: { type: String, trim: true, default: 'General' },
    assignedOffice: { type: Schema.Types.ObjectId, ref: 'Office', default: null },
    avatar: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    // Self-signup approval workflow – admin-created users are APPROVED instantly,
    // self signups start as PENDING until an admin approves.
    approvalStatus: { type: String, enum: [...REVIEWABLE_STATUSES], default: 'APPROVED' },
    approvalNote: { type: String, default: '' },
    themePreference: { type: String, enum: [...THEME_PREFERENCES], default: 'system' },
    restrictedPages: { type: [String], default: [] },
    googleId: { type: String, default: '' },
    loginMethod: { type: String, enum: [...LOGIN_METHODS], default: 'PASSWORD' },
    emailVerified: { type: Boolean, default: false },
    verificationOtp: { type: String, default: null },
    verificationOtpExpiry: { type: Date, default: null },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    temporaryAssignment: { type: tempAssignmentSchema, default: null },
    leaveBalances: {
      casual: { type: Number, default: 12 },
      sick: { type: Number, default: 6 },
      earned: { type: Number, default: 0 },
    },
    shiftStartTime: { type: String, default: '' },
    shiftEndTime: { type: String, default: '' },
  },
  { timestamps: true },
);

// Hash password automatically whenever it is set/changed.
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await hashPassword(this.password);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return Promise.resolve(false);
  return comparePasswords(candidatePassword, this.password);
};

// Guard against re-registration during dev hot-reload.
export const UserModel: UserModelType =
  (mongoose.models.User as UserModelType) ||
  mongoose.model<IUser, UserModelType>('User', userSchema);
