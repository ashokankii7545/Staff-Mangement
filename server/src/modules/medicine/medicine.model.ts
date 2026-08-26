import mongoose, { Schema, type Model } from 'mongoose';
import {
  MEDICINE_STATUSES,
  MEDICINE_UNITS,
  MEDICINE_URGENCIES,
} from '../../config/constants.js';

/** Pharmacy stock request raised by staff for the owner/admin. */
export interface IMedicineRequest {
  requestedBy: mongoose.Types.ObjectId;
  medicineName: string;
  strength: string;
  quantity: number;
  unit: string;
  urgency: string;
  notes: string;
  status: (typeof MEDICINE_STATUSES)[number];
  adminFeedback: string;
  handledBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type MedicineRequestDocument = mongoose.HydratedDocument<IMedicineRequest>;

const medicineRequestSchema = new Schema<IMedicineRequest>(
  {
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    medicineName: { type: String, required: true, trim: true },
    strength: { type: String, trim: true, default: '' }, // e.g. "500mg", "10ml"
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, enum: [...MEDICINE_UNITS], default: 'Strips' },
    urgency: { type: String, enum: [...MEDICINE_URGENCIES], default: 'NORMAL' },
    notes: { type: String, trim: true, default: '' },
    status: { type: String, enum: [...MEDICINE_STATUSES], default: 'PENDING' },
    adminFeedback: { type: String, trim: true, default: '' },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

medicineRequestSchema.index({ status: 1, createdAt: -1 });
medicineRequestSchema.index({ requestedBy: 1, createdAt: -1 });

export const MedicineRequestModel: Model<IMedicineRequest> =
  (mongoose.models.MedicineRequest as Model<IMedicineRequest>) ||
  mongoose.model<IMedicineRequest>('MedicineRequest', medicineRequestSchema);
