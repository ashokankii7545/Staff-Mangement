import mongoose, { Schema, type Model } from 'mongoose';
import { APPROVAL_STATUSES, LEAVE_TYPES } from '../../config/constants.js';

export interface ILeaveRequest {
  user: mongoose.Types.ObjectId;
  leaveType: (typeof LEAVE_TYPES)[number];
  startDate: Date;
  endDate: Date;
  reason: string;
  status: (typeof APPROVAL_STATUSES)[number];
  adminFeedback?: string;
  approvedBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type LeaveRequestDocument = mongoose.HydratedDocument<ILeaveRequest>;

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    leaveType: { type: String, enum: [...LEAVE_TYPES], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: [...APPROVAL_STATUSES], default: 'PENDING' },
    adminFeedback: { type: String, trim: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const LeaveRequestModel: Model<ILeaveRequest> =
  (mongoose.models.LeaveRequest as Model<ILeaveRequest>) ||
  mongoose.model<ILeaveRequest>('LeaveRequest', leaveRequestSchema);
