import mongoose, { Schema, type Model } from 'mongoose';
import { NOTIFICATION_TYPES, type NotificationTypeUnion } from '../../config/constants.js';

export interface INotification {
  recipient: mongoose.Types.ObjectId;
  type: NotificationTypeUnion;
  title: string;
  message: string;
  /** In-app deep link, e.g. '/approvals' or '/leaves' */
  link: string;
  meta: Record<string, unknown>;
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type NotificationDocument = mongoose.HydratedDocument<INotification>;

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: [...NOTIFICATION_TYPES], default: 'GENERIC' },
    title: { type: String, required: true, trim: true },
    message: { type: String, default: '' },
    link: { type: String, default: '' },
    meta: { type: Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export const NotificationModel: Model<INotification> =
  (mongoose.models.Notification as Model<INotification>) ||
  mongoose.model<INotification>('Notification', notificationSchema);
