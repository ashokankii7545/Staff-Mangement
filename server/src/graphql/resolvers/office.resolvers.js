import Office from '../../models/Office.js';
import { requireAdmin } from '../../middleware/auth.js';
import { sendOfficeChangeEmail } from '../../services/mail.service.js';

export default {
  Query: {
    offices: async () => {
      return Office.find({ isActive: true }).sort({ createdAt: -1 });
    },
    office: async (_, { id }) => {
      return Office.findById(id);
    },
  },
  Mutation: {
    createOffice: async (_, { input }, { user }) => {
      requireAdmin(user);
      const office = new Office(input);
      await office.save();
      // Every site change is an org-level update – email all admins
      sendOfficeChangeEmail({ action: 'added', office }).catch(console.error);
      return office;
    },
    updateOffice: async (_, { id, input }, { user }) => {
      requireAdmin(user);
      const office = await Office.findByIdAndUpdate(id, input, { new: true });
      if (!office) throw new Error('Office not found');
      sendOfficeChangeEmail({ action: 'updated', office }).catch(console.error);
      return office;
    },
    deleteOffice: async (_, { id }, { user }) => {
      requireAdmin(user);
      // Soft delete
      const office = await Office.findByIdAndUpdate(id, { isActive: false });
      if (office) sendOfficeChangeEmail({ action: 'deleted', office }).catch(console.error);
      return true;
    },
  },
};
