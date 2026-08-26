import mongoose, { Schema, type Model } from 'mongoose';
import { REVIEWABLE_STATUSES } from '../../config/constants.js';

/** Punch-correction request for a past day. */
export interface IRegularization {
  user: mongoose.Types.ObjectId;
  date: string;
  checkInTime: string;
  checkOutTime: string;
  reason: string;
  status: (typeof REVIEWABLE_STATUSES)[number];
  adminFeedback?: string;
  approvedBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type RegularizationDocument = mongoose.HydratedDocument<IRegularization>;

const regularizationSchema = new Schema<IRegularization>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    checkInTime: { type: String, required: true },
    checkOutTime: { type: String, required: true },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: [...REVIEWABLE_STATUSES], default: 'PENDING' },
    adminFeedback: { type: String, trim: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const RegularizationModel: Model<IRegularization> =
  (mongoose.models.Regularization as Model<IRegularization>) ||
  mongoose.model<IRegularization>('Regularization', regularizationSchema);
