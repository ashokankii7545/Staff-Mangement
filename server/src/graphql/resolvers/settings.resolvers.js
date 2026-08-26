import Settings from '../../models/Settings.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { sendSettingsChangeEmail } from '../../services/mail.service.js';

export default {
  Query: {
    settings: async (_, __, { user }) => {
      requireAuth(user);
      let settings = await Settings.findOne();
      if (!settings) {
        settings = await Settings.create({});
      }
      return settings;
    },
  },
  
  Mutation: {
    updateSettings: async (_, { input }, { user }) => {
      requireAdmin(user);
      let settings = await Settings.findOne();
      if (!settings) {
        settings = new Settings({});
      }
      Object.assign(settings, input);
      await settings.save();
      // Org-level change – let every admin know something was touched
      sendSettingsChangeEmail(user.name).catch(console.error);
      return settings;
    },
  },
  
  Settings: {
    id: (parent) => parent._id || parent.id,
  },
};
