import mongoose, { Schema, type Model } from 'mongoose';
import { PUNCH_TYPES, REVIEWABLE_STATUSES } from '../../config/constants.js';

/** GPS snapshot attached to every punch. */
export interface IPunchLocation {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  address: string;
  withinGeofence: boolean;
  distanceFromOffice: number;
  branchName: string;
  isCoverDuty: boolean;
}

export interface IVpnCheckDetails {
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  webrtcMismatch: boolean;
  timezoneMismatch: boolean;
}

export interface IAttendance {
  user: mongoose.Types.ObjectId;
  punchedOffice?: mongoose.Types.ObjectId | null;
  isCoverDuty: boolean;
  type: (typeof PUNCH_TYPES)[number];
  selfieUrl: string;
  location: IPunchLocation;
  ipAddress: string;
  vpnDetected: boolean;
  vpnCheckDetails?: IVpnCheckDetails;
  browserTimezone: string;
  /** `YYYY-MM-DD` – canonical day key for fast daily queries. */
  date: string;
  approvalStatus: (typeof REVIEWABLE_STATUSES)[number];
  approvedBy?: mongoose.Types.ObjectId | null;
  adminComments?: string;
  /** Face identity check vs profile avatar; false forces admin review. */
  faceMatched?: boolean;
  /** Euclidean descriptor distance – lower = closer match. */
  faceMatchScore?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AttendanceDocument = mongoose.HydratedDocument<IAttendance>;

const locationSchema = new Schema<IPunchLocation>(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number },
    address: { type: String, default: '' },
    withinGeofence: { type: Boolean, default: false },
    distanceFromOffice: { type: Number, default: 0 },
    branchName: { type: String, default: '' },
    isCoverDuty: { type: Boolean, default: false },
  },
  { _id: false },
);

const attendanceSchema = new Schema<IAttendance>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    punchedOffice: { type: Schema.Types.ObjectId, ref: 'Office' },
    isCoverDuty: { type: Boolean, default: false },
    type: { type: String, enum: [...PUNCH_TYPES], required: true },
    selfieUrl: { type: String, required: true },
    location: { type: locationSchema, required: true },
    ipAddress: { type: String, default: '' },
    vpnDetected: { type: Boolean, default: false },
    vpnCheckDetails: {
      vpn: { type: Boolean, default: false },
      proxy: { type: Boolean, default: false },
      tor: { type: Boolean, default: false },
      webrtcMismatch: { type: Boolean, default: false },
      timezoneMismatch: { type: Boolean, default: false },
    },
    browserTimezone: { type: String, default: '' },
    date: { type: String, required: true }, // YYYY-MM-DD
    approvalStatus: { type: String, enum: [...REVIEWABLE_STATUSES], default: 'PENDING' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    adminComments: { type: String, trim: true },
    faceMatched: { type: Boolean },
    faceMatchScore: { type: Number },
  },
  { timestamps: true },
);

// Compound indexes for fast daily lookups
attendanceSchema.index({ user: 1, date: 1, type: 1 });
attendanceSchema.index({ date: 1 });

// ⚡ HARD DB GUARANTEE against double-punch races: the findOne pre-check in
// the service is advisory UX only – two simultaneous punches are stopped by
// THIS unique index (surfaces as duplicate-key error → friendly message).
attendanceSchema.index({ user: 1, date: 1, type: 1 }, { unique: true });

export const AttendanceModel: Model<IAttendance> =
  (mongoose.models.Attendance as Model<IAttendance>) ||
  mongoose.model<IAttendance>('Attendance', attendanceSchema);
