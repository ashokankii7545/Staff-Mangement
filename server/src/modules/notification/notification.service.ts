import { PUBSUB_CHANNELS } from '../../config/constants.js';
import { logger } from '../../shared/logger/logger.js';
import { pubsub } from '../../shared/graphql/pubsub.js';
import type { PillSpec, TemplateRow } from '../../shared/mail/email-template.js';
import { mailService } from '../../shared/mail/mail.service.js';
import { userRepository } from '../user/user.repository.js';
import { notificationRepository } from './notification.repository.js';
import type { NotificationTypeUnion } from '../../config/constants.js';

export interface PushNotificationInput {
  recipientIds?: Array<string | { toString(): string }>;
  adminBroadcast?: boolean;
  /** Actor's id – they NEVER get notified about their own action */
  excludeUserId?: string | null;
  type?: NotificationTypeUnion;
  title: string;
  message?: string;
  link?: string;
  meta?: Record<string, unknown>;
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * NOTIFICATION SERVICE – SINGLETON facade over the in-app inbox + realtime bus
 * ────────────────────────────────────────────────────────────────────────────
 * Creates notifications and pushes them over the NOTIFICATION_ADDED
 * subscription. NEVER throws – a notification failure must not break the main
 * business flow (punch / leave / signup).
 */
class NotificationService {
  private static instance: NotificationService | null = null;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async push(input: PushNotificationInput): Promise<unknown[]> {
    try {
      let ids = [...new Set((input.recipientIds ?? []).filter(Boolean).map(String))];

      if (input.adminBroadcast) {
        const admins = await userRepository.queries.findActiveAdmins();
        ids.push(...admins.map((a) => String(a._id)));
      }

      ids = [...new Set(ids)];
      // Suppress self-notifications – actor never pings themselves.
      if (input.excludeUserId) {
        const excluded = String(input.excludeUserId);
        ids = ids.filter((id) => id !== excluded);
      }
      if (ids.length === 0) return [];

      const docs = await notificationRepository.queries.insertManyNotifications(
        ids.map((recipientId) => ({
          recipient: recipientId,
          type: input.type ?? 'GENERIC',
          title: input.title,
          message: input.message ?? '',
          link: input.link ?? '',
          meta: input.meta ?? {},
        })),
      );

      // Publish per-recipient so each connected client only gets its own copy.
      for (const doc of docs) {
        const populated = await notificationRepository.queries.findByIdPopulatedRecipient(
          String(doc._id),
        );
        pubsub.publish(PUBSUB_CHANNELS.NOTIFICATION_ADDED, { notificationAdded: populated });
      }

      return docs;
    } catch (error) {
      logger.error('pushNotification failed', error);
      return [];
    }
  }

  /** Notify every active admin in-app AND over the branded alert email. */
  public async notifyAdmins(
    args: PushNotificationInput & {
      pill?: PillSpec | null;
      rows?: TemplateRow[];
      noteText?: string;
    },
  ): Promise<unknown[]> {
    void mailService.sendAdminNotificationEmail({
      title: args.title,
      message: args.message,
      link: args.link,
      pill: args.pill ?? null,
      rows: args.rows,
      noteText: args.noteText,
    });
    return this.push({ ...args, adminBroadcast: true });
  }

  // ── USER INBOX OPERATIONS (resolver-facing) ───────────────────────────────

  public listForUser(
    recipientId: string,
    options: { limit?: number; unreadOnly?: boolean } = {},
  ): Promise<unknown> {
    return notificationRepository.queries.listForRecipient(recipientId, options);
  }

  public unreadCount(recipientId: string): Promise<number> {
    return notificationRepository.queries.countUnread(recipientId);
  }

  public markRead(id: string, recipientId: string): Promise<unknown> {
    return notificationRepository.queries.markOneRead(id, recipientId);
  }

  public markAllRead(recipientId: string): Promise<number> {
    return notificationRepository.queries.markAllRead(recipientId);
  }

  public clearRead(recipientId: string): Promise<number> {
    return notificationRepository.queries.clearRead(recipientId);
  }

  public remove(id: string, recipientId: string): Promise<boolean> {
    return notificationRepository.queries.deleteForRecipient(id, recipientId);
  }
}

export const notificationService = NotificationService.getInstance();

