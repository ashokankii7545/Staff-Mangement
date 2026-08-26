import { sendAdminNotificationEmail } from './mail.service.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { pubsub, CHANNELS } from '../graphql/pubsub.js';

/**
 * Create in-app notifications and push them over the NOTIFICATION_ADDED
 * subscription. NEVER throws – a notification failure must not break the
 * main business flow (punch / leave / signup).
 */
export const pushNotification = async ({
  recipientIds = [],
  adminBroadcast = false,
  /** Actor's id – they NEVER get notified about their own action */
  excludeUserId = null,
  type = 'GENERIC',
  title,
  message = '',
  link = '',
  meta = {},
}) => {
  try {
    let ids = [...new Set(recipientIds.filter(Boolean).map((id) => id.toString()))];

    if (adminBroadcast) {
      const admins = await User.find({ role: 'ADMIN', isActive: true }).select('_id');
      ids.push(...admins.map((a) => a._id.toString()));
    }

    ids = [...new Set(ids)];
    // Suppress self-notifications – "maine khud ki request approve ki" wale
    // updates ka inbox spam kisi ko nahi chahiye.
    if (excludeUserId) {
      const excluded = String(excludeUserId);
      ids = ids.filter((id) => id !== excluded);
    }
    if (ids.length === 0) return [];

    const docs = await Notification.insertMany(
      ids.map((recipientId) => ({ recipient: recipientId, type, title, message, link, meta }))
    );

    // Publish per-recipient so each connected client only receives its own copy
    for (const doc of docs) {
      const populated = await Notification.findById(doc._id).populate('recipient', 'name employeeId avatar');
      pubsub.publish(CHANNELS.NOTIFICATION_ADDED, { notificationAdded: populated });
    }

    return docs;
  } catch (err) {
    console.error('pushNotification failed:', err.message);
    return [];
  }
};

  /** Convenience wrapper: notify every active admin */
export const notifyAdmins = (args) => { sendAdminNotificationEmail(args); return pushNotification({ ...args, adminBroadcast: true }); };
