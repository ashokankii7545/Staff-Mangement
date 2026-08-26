import mongoose, { Schema, type Model } from 'mongoose';

/**
 * Day-off exemption – admin grants a specific staff member a paid/free day.
 * Exempted days are excluded from "absent" counts and shown as EXEMPT status.
 */
export interface IExemption {
  user: mongoose.Types.ObjectId;
  /** `YYYY-MM-DD` */
  date: string;
  reason: string;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ExemptionDocument = mongoose.HydratedDocument<IExemption>;

const exemptionSchema = new Schema<IExemption>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    reason: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

exemptionSchema.index({ user: 1, date: 1 }, { unique: true });

export const ExemptionModel: Model<IExemption> =
  (mongoose.models.Exemption as Model<IExemption>) ||
  mongoose.model<IExemption>('Exemption', exemptionSchema);
