import mongoose from 'mongoose';

const TYPES = [
  'LEAVE_REQUEST',
  'LEAVE_DECISION',
  'REGULARIZATION_REQUEST',
  'REGULARIZATION_DECISION',
  'ATTENDANCE_FLAGGED',
  'ATTENDANCE_DECISION',
  'SIGNUP_REQUEST',
  'SIGNUP_DECISION',
  'TEMP_DUTY',
  'DAY_OFF',
  'MEDICINE_REQUEST',
  'MEDICINE_DECISION',
  'PUNCH_REMINDER',
  'DOCUMENT_UPLOADED',
  'DOCUMENT_DECISION',
  'GENERIC',
];

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TYPES, default: 'GENERIC' },
    title: { type: String, required: true, trim: true },
    message: { type: String, default: '' },
    /** In-app deep link, e.g. '/approvals' or '/leaves' */
    link: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
