import Notification from '../../models/Notification.js';
import { requireAuth } from '../../middleware/auth.js';
import { pubsub, CHANNELS } from '../pubsub.js';
import { withFilter } from 'graphql-subscriptions';

export default {
  Subscription: {
    /**
     * Real-time per-user notification stream.
     * Requires an authenticated WS context (see server index.js) – clients only
     * ever receive notifications addressed to them.
     */
    notificationAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator([CHANNELS.NOTIFICATION_ADDED]),
        (payload, __, ctx) => {
          const recipientId = payload.notificationAdded?.recipient?._id;
          return !!recipientId && recipientId.toString() === ctx.user?._id?.toString();
        }
      ),
    },
  },

  Query: {
    myNotifications: async (_, { limit = 30, unreadOnly }, { user }) => {
      requireAuth(user);
      const query = { recipient: user._id };
      if (unreadOnly) query.isRead = false;
      return Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(Math.min(limit, 100))
        .populate('recipient', 'name employeeId avatar');
    },

    unreadNotificationsCount: async (_, __, { user }) => {
      requireAuth(user);
      return Notification.countDocuments({ recipient: user._id, isRead: false });
    },
  },

  Mutation: {
    markNotificationRead: async (_, { id }, { user }) => {
      requireAuth(user);
      return Notification.findOneAndUpdate(
        { _id: id, recipient: user._id },
        { isRead: true },
        { new: true }
      );
    },

    markAllNotificationsRead: async (_, __, { user }) => {
      requireAuth(user);
      const res = await Notification.updateMany(
        { recipient: user._id, isRead: false },
        { isRead: true }
      );
      return res.modifiedCount || 0;
    },

    /** Inbox hygiene – purge every already-seen notification for this user */
    clearReadNotifications: async (_, __, { user }) => {
      requireAuth(user);
      const res = await Notification.deleteMany({ recipient: user._id, isRead: true });
      return res.deletedCount || 0;
    },

    deleteNotification: async (_, { id }, { user }) => {
      requireAuth(user);
      const res = await Notification.deleteOne({ _id: id, recipient: user._id });
      return res.deletedCount > 0;
    },
  },

  Notification: {
    id: (parent) => parent._id || parent.id,
  },
};
