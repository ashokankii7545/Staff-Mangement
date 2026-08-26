import { BaseRepository } from '../../shared/repository/base-repository.js';
import {
  NotificationModel,
  type INotification,
  type NotificationDocument,
} from './notification.model.js';

/**
 * NotificationRepository – in-app inbox data access.
 */
export class NotificationRepository extends BaseRepository<INotification> {
  private static instance: NotificationRepository | null = null;

  private constructor() {
    super(NotificationModel);
  }

  public static getInstance(): NotificationRepository {
    if (!NotificationRepository.instance) {
      NotificationRepository.instance = new NotificationRepository();
    }
    return NotificationRepository.instance;
  }

  /** ── QUERY CATALOG ─────────────────────────────────────────────────────── */
  public readonly queries = {
    listForRecipient: (
      recipientId: string,
      options: { limit?: number; unreadOnly?: boolean } = {},
    ): Promise<NotificationDocument[]> =>
      this.exec('listForRecipient', () => {
        const filter: Record<string, unknown> = { recipient: recipientId };
        if (options.unreadOnly) filter.isRead = false;
        return NotificationModel.find(filter)
          .sort({ createdAt: -1 })
          .limit(Math.min(options.limit ?? 30, 100))
          .populate('recipient', 'name employeeId avatar') as Promise<NotificationDocument[]>;
      }),

    countUnread: (recipientId: string): Promise<number> =>
      this.exec('countUnread', () => this.qCount({ recipient: recipientId, isRead: false })),

    markOneRead: (id: string, recipientId: string): Promise<NotificationDocument | null> =>
      this.exec('markOneRead', () =>
        NotificationModel.findOneAndUpdate(
          { _id: id, recipient: recipientId },
          { isRead: true },
          { new: true },
        ) as Promise<NotificationDocument | null>,
      ),

    markAllRead: (recipientId: string): Promise<number> =>
      this.exec('markAllRead', async () => {
        const res = await NotificationModel.updateMany(
          { recipient: recipientId, isRead: false },
          { isRead: true },
        );
        return res.modifiedCount || 0;
      }),

    deleteForRecipient: (id: string, recipientId: string): Promise<boolean> =>
      this.exec('deleteForRecipient', async () => {
        const res = await NotificationModel.deleteOne({ _id: id, recipient: recipientId });
        return res.deletedCount > 0;
      }),

    clearRead: (recipientId: string): Promise<number> =>
      this.exec('clearRead', async () => {
        const res = await NotificationModel.deleteMany({ recipient: recipientId, isRead: true });
        return res.deletedCount || 0;
      }),

    insertManyNotifications: (docs: Array<Record<string, unknown>>): Promise<NotificationDocument[]> =>
      this.exec('insertManyNotifications', async () => {
        const inserted = await NotificationModel.insertMany(docs);
        return inserted as unknown as NotificationDocument[];
      }),

    findByIdPopulatedRecipient: (
      id: string,
      fields = 'name employeeId avatar',
    ): Promise<NotificationDocument | null> =>
      this.exec('findByIdPopulatedRecipient', async () => {
        const doc = await NotificationModel.findById(id);
        return doc ? ((await doc.populate('recipient', fields)) as NotificationDocument) : null;
      }),

    /**
     * Close stale notifications across EVERY admin inbox once their workflow
     * item was processed (leave/regularization/attendance/document/medicine).
     */
    closeMetaNotifications: (type: string, metaKey: string, metaValue: string): Promise<void> =>
      this.exec('closeMetaNotifications', async () => {
        await NotificationModel.updateMany(
          { type, [`meta.${metaKey}`]: metaValue },
          { isRead: true },
        ).catch(() => undefined);
      }),

    deleteSignupRequests: (userId: string): Promise<void> =>
      this.exec('deleteSignupRequests', async () => {
        await NotificationModel.deleteMany({
          'meta.userId': String(userId),
          type: 'SIGNUP_REQUEST',
        }).catch(() => undefined);
      }),

    /** Reminder de-dupe guard – fires AT MOST ONCE per staff/day/kind. */
    findReminderByKey: (reminderKey: string): Promise<NotificationDocument | null> =>
      this.exec('findReminderByKey', () =>
        NotificationModel.findOne({
          type: 'PUNCH_REMINDER',
          'meta.reminderKey': reminderKey,
        }).lean() as Promise<NotificationDocument | null>,
      ),
  };
}

export const notificationRepository = NotificationRepository.getInstance();
