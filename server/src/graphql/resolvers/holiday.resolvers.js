import Holiday from '../../models/Holiday.js';
import { requireAdmin } from '../../middleware/auth.js';
import { sendHolidayChangeEmail } from '../../services/mail.service.js';

export default {
  Query: {
    holidays: async (_, { year }, { user }) => {
      const filter = { isActive: true };
      if (year) {
        const startOfYear = new Date(`${year}-01-01`);
        const endOfYear = new Date(`${year}-12-31`);
        filter.date = { $gte: startOfYear, $lte: endOfYear };
      }
      return Holiday.find(filter).sort({ date: 1 });
    },
  },
  
  Mutation: {
    createHoliday: async (_, { input }, { user }) => {
      requireAdmin(user);
      const holiday = new Holiday(input);
      await holiday.save();
      sendHolidayChangeEmail({ action: 'added', holiday }).catch(console.error);
      return holiday;
    },
    
    deleteHoliday: async (_, { id }, { user }) => {
      requireAdmin(user);
      const holiday = await Holiday.findByIdAndDelete(id);
      if (holiday) sendHolidayChangeEmail({ action: 'removed', holiday }).catch(console.error);
      return true;
    },
  },
  
  Holiday: {
    id: (parent) => parent._id || parent.id
  }
};
