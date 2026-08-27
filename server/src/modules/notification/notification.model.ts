import type { WithId } from '../../shared/repository/base-repository.js';
import type { NotificationRow } from '../../db/schema/notification.schema.js';
import type { NotificationTypeUnion } from '../../config/constants.js';

/** Notification types – backed by Postgres/Drizzle. */
export interface INotification {
  recipient: string;
  type: NotificationTypeUnion;
  title: string;
  message: string;
  link: string;
  meta: Record<string, unknown>;
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type NotificationDocument = WithId<NotificationRow>;
