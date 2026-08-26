import { withFilter } from 'graphql-subscriptions';
import { notificationService } from './notification.service.js';
import { pubsub, PUBSUB_CHANNELS } from '../../shared/graphql/pubsub.js';
import { requireAuth } from '../../shared/guards/auth.guard.js';
import type { NotificationDocument, INotification } from './notification.model.js';
import type { ContextValue } from '../../graphql/context.js';

interface NotificationPayload {
  notificationAdded?: (NotificationDocument & { recipient?: { _id?: unknown } }) | null;
}

export const notificationResolvers = {
  Subscription: {
    /**
     * Real-time per-user notification stream. Requires an authenticated WS
     * context – clients only ever receive notifications addressed to them.
     */
    notificationAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator([PUBSUB_CHANNELS.NOTIFICATION_ADDED]),
        (payload: unknown, _variables: unknown, ctx?: ContextValue) => {
          const data = payload as NotificationPayload;
          const recipientId = data.notificationAdded?.recipient?._id;
          return (
            !!recipientId &&
            String(recipientId) === String(ctx?.user?._id ?? '')
          );
        },
      ),
    },
  },

  Query: {
    myNotifications: async (
      _parent: unknown,
      args: { limit?: number; unreadOnly?: boolean },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return notificationService.listForUser(String(user._id), args);
    },

    unreadNotificationsCount: async (
      _parent: unknown,
      _args: Record<string, never>,
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return notificationService.unreadCount(String(user._id));
    },
  },

  Mutation: {
    markNotificationRead: async (
      _parent: unknown,
      args: { id: string },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return notificationService.markRead(args.id, String(user._id));
    },

    markAllNotificationsRead: async (
      _parent: unknown,
      _args: Record<string, never>,
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return notificationService.markAllRead(String(user._id));
    },

    /** Inbox hygiene – purge every already-seen notification for this user */
    clearReadNotifications: async (
      _parent: unknown,
      _args: Record<string, never>,
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return notificationService.clearRead(String(user._id));
    },

    deleteNotification: async (
      _parent: unknown,
      args: { id: string },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return notificationService.remove(args.id, String(user._id));
    },
  },

  Notification: {
    id: (parent: INotification) =>
      (parent as unknown as { _id?: unknown })._id ??
      (parent as unknown as { id?: unknown }).id,
  },
};
