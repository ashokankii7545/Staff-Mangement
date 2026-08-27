import { boolean, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { users } from './user.schema.js';

/** In-app notifications (old Mongo `Notification` collection). meta is jsonb. */
export const notifications = pgTable(
  'notifications',
  {
    id: primaryId(),
    recipient: uuid('recipient')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull().default('GENERIC'),
    title: text('title').notNull(),
    message: text('message').notNull().default(''),
    link: text('link').notNull().default(''),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    isRead: boolean('is_read').notNull().default(false),
    ...timestamps,
  },
  (t) => ({
    recipientReadIdx: index('notifications_recipient_read_idx').on(t.recipient, t.isRead),
  }),
);

export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotificationRow = typeof notifications.$inferInsert;
