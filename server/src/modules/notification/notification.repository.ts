import { and, desc, eq, sql } from 'drizzle-orm';
import { BaseRepository } from '../../shared/repository/base-repository.js';
import { notifications } from '../../db/schema/notification.schema.js';
import { users } from '../../db/schema/user.schema.js';
import type { INotification, NotificationDocument } from './notification.model.js';

/**
 * NotificationRepository – in-app inbox data access (Postgres/Drizzle).
 * "Populated recipient" variants attach the recipient user object (with _id)
 * so the subscription filter (`recipient._id`) keeps working unchanged.
 */
export class NotificationRepository extends BaseRepository<typeof notifications> {
  private static instance: NotificationRepository | null = null;

  /** Short-TTL cache for recipient user objects (inbox reads repeat per request). */
  private static readonly RECIPIENT_CACHE_TTL_MS = 30_000;
  private recipientCache = new Map<string, { user: { _id: string } | null; at: number }>();

  private constructor() {
    super(notifications);
  }

  public static getInstance(): NotificationRepository {
    if (!NotificationRepository.instance) {
      NotificationRepository.instance = new NotificationRepository();
    }
    return NotificationRepository.instance;
  }

  /** Resolve a recipient user object, cached briefly to avoid repeat SELECTs. */
  private async recipient(userId: string): Promise<{ _id: string } | null> {
    const hit = this.recipientCache.get(userId);
    if (hit && Date.now() - hit.at < NotificationRepository.RECIPIENT_CACHE_TTL_MS) {
      return hit.user;
    }
    const u = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = u[0] ? { ...u[0], _id: String(u[0].id) } : null;
    this.recipientCache.set(userId, { user, at: Date.now() });
    return user;
  }

  /** Attach the populated recipient user (with _id) to a notification row. */
  private async populateRecipient(row: NotificationDocument | null): Promise<NotificationDocument | null> {
    if (!row) return null;
    const recipient = await this.recipient(String(row.recipient));
    return { ...row, recipient } as unknown as NotificationDocument;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    listForRecipient: (
      recipientId: string,
      options: { limit?: number; unreadOnly?: boolean } = {},
    ): Promise<NotificationDocument[]> =>
      this.exec('listForRecipient', async () => {
        const conditions = [eq(notifications.recipient, recipientId)];
        if (options.unreadOnly) conditions.push(eq(notifications.isRead, false));
        const rows = await this.db
          .select()
          .from(notifications)
          .where(and(...conditions))
          .orderBy(desc(notifications.createdAt))
          .limit(Math.min(options.limit ?? 30, 100));
        if (rows.length === 0) return [];
        // Populate recipient so the `Notification.recipient: User!` field
        // resolves against a full user object. All rows share one recipient,
        // so we resolve it ONCE (cached) and attach it to every row.
        const recipient = await this.recipient(recipientId);
        return this.withIds(rows).map((r) => ({ ...r, recipient })) as unknown as NotificationDocument[];
      }),

    countUnread: (recipientId: string): Promise<number> =>
      this.exec('countUnread', () =>
        this.qCount(and(eq(notifications.recipient, recipientId), eq(notifications.isRead, false))!),
      ),

    markOneRead: (id: string, recipientId: string): Promise<NotificationDocument | null> =>
      this.exec('markOneRead', async () => {
        const rows = await this.db
          .update(notifications)
          .set({ isRead: true, updatedAt: new Date() })
          .where(and(eq(notifications.id, id), eq(notifications.recipient, recipientId)))
          .returning();
        return this.populateRecipient(this.withId(rows[0] ?? null) as NotificationDocument | null);
      }),

    markAllRead: (recipientId: string): Promise<number> =>
      this.exec('markAllRead', async () => {
        const rows = await this.db
          .update(notifications)
          .set({ isRead: true, updatedAt: new Date() })
          .where(and(eq(notifications.recipient, recipientId), eq(notifications.isRead, false)))
          .returning({ id: notifications.id });
        return rows.length;
      }),

    deleteForRecipient: (id: string, recipientId: string): Promise<boolean> =>
      this.exec('deleteForRecipient', async () => {
        const rows = await this.db
          .delete(notifications)
          .where(and(eq(notifications.id, id), eq(notifications.recipient, recipientId)))
          .returning({ id: notifications.id });
        return rows.length > 0;
      }),

    clearRead: (recipientId: string): Promise<number> =>
      this.exec('clearRead', async () => {
        const rows = await this.db
          .delete(notifications)
          .where(and(eq(notifications.recipient, recipientId), eq(notifications.isRead, true)))
          .returning({ id: notifications.id });
        return rows.length;
      }),

    insertManyNotifications: (docs: Array<Record<string, unknown>>): Promise<NotificationDocument[]> =>
      this.exec('insertManyNotifications', async () => {
        if (docs.length === 0) return [];
        const rows = await this.db.insert(notifications).values(docs as never).returning();
        return this.withIds(rows) as NotificationDocument[];
      }),

    findByIdPopulatedRecipient: (id: string): Promise<NotificationDocument | null> =>
      this.exec('findByIdPopulatedRecipient', async () => {
        const row = (await this.qFindById(id)) as NotificationDocument | null;
        return this.populateRecipient(row);
      }),

    /**
     * Close stale notifications across EVERY admin inbox once their workflow
     * item was processed. Matches on a jsonb meta key.
     */
    closeMetaNotifications: (type: string, metaKey: string, metaValue: string): Promise<void> =>
      this.exec('closeMetaNotifications', async () => {
        await this.db
          .update(notifications)
          .set({ isRead: true, updatedAt: new Date() })
          .where(
            and(
              eq(notifications.type, type),
              sql`${notifications.meta} ->> ${metaKey} = ${metaValue}`,
            ),
          );
      }),

    deleteSignupRequests: (userId: string): Promise<void> =>
      this.exec('deleteSignupRequests', async () => {
        await this.db
          .delete(notifications)
          .where(
            and(
              eq(notifications.type, 'SIGNUP_REQUEST'),
              sql`${notifications.meta} ->> 'userId' = ${String(userId)}`,
            ),
          );
      }),

    /** Reminder de-dupe guard – fires AT MOST ONCE per staff/day/kind. */
    findReminderByKey: (reminderKey: string): Promise<NotificationDocument | null> =>
      this.exec('findReminderByKey', () =>
        this.qFindOne(
          and(
            eq(notifications.type, 'PUNCH_REMINDER'),
            sql`${notifications.meta} ->> 'reminderKey' = ${reminderKey}`,
          )!,
        ) as Promise<NotificationDocument | null>,
      ),

    /**
     * Generic de-dupe guard for any notification type – finds an existing row
     * carrying `meta[key] = value` (used by the daily absent-alert job).
     */
    findByMetaKey: (type: string, metaKey: string, metaValue: string): Promise<NotificationDocument | null> =>
      this.exec('findByMetaKey', () =>
        this.qFindOne(
          and(
            eq(notifications.type, type),
            sql`${notifications.meta} ->> ${metaKey} = ${metaValue}`,
          )!,
        ) as Promise<NotificationDocument | null>,
      ),
  };
}

export const notificationRepository = NotificationRepository.getInstance();
