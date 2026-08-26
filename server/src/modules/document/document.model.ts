import mongoose, { Schema, type Model } from 'mongoose';
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUSES, REVIEWABLE_STATUSES } from '../../config/constants.js';

/**
 * Staff document vault – optional uploads (ID proof, certificates).
 * Admin verifies; nothing here is mandatory for attendance.
 * Lifecycle: PENDING → VERIFIED / REJECTED.
 */
export interface IStaffDocument {
  uploadedBy: mongoose.Types.ObjectId;
  title: string;
  category: (typeof DOCUMENT_CATEGORIES)[number];
  fileUrl: string;
  status: (typeof REVIEWABLE_STATUSES)[number] | (typeof DOCUMENT_STATUSES)[number];
  adminFeedback: string;
  reviewedBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type StaffDocumentModelDoc = mongoose.HydratedDocument<IStaffDocument>;

const documentSchema = new Schema<IStaffDocument>(
  {
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, enum: [...DOCUMENT_CATEGORIES], default: 'OTHER' },
    fileUrl: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING' },
    adminFeedback: { type: String, trim: true, default: '' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

documentSchema.index({ uploadedBy: 1, createdAt: -1 });
documentSchema.index({ status: 1, createdAt: -1 });

export const StaffDocumentModel: Model<IStaffDocument> =
  (mongoose.models.StaffDocument as Model<IStaffDocument>) ||
  mongoose.model<IStaffDocument>('StaffDocument', documentSchema);
