import Notification from '../../models/Notification.js';
import MedicineRequest from '../../models/MedicineRequest.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { pushNotification, notifyAdmins } from '../../services/notification.service.js';
import { sendUserUpdateEmail } from '../../services/mail.service.js';

const STATUS_PILL = {
  ORDERED: { label: 'ORDERED', tone: 'info' },
  SUPPLIED: { label: 'SUPPLIED', tone: 'success' },
  REJECTED: { label: 'REJECTED', tone: 'error' },
};

export default {
  Query: {
    myMedicineRequests: async (_, __, { user }) => {
      requireAuth(user);
      return MedicineRequest.find({ requestedBy: user._id })
        .sort({ createdAt: -1 })
        .limit(200)
        .populate('requestedBy')
        .populate('handledBy');
    },

    allMedicineRequests: async (_, { status }, { user }) => {
      requireAdmin(user);
      const query = {};
      if (status) query.status = status;
      return MedicineRequest.find(query)
        .sort({ createdAt: -1 })
        .limit(300)
        .populate('requestedBy')
        .populate('handledBy');
    },
  },

  Mutation: {
    /** Staff flags a missing / short medicine → lands in the admin's inbox */
    requestMedicine: async (_, { input }, { user }) => {
      requireAuth(user);

      const medicineName = String(input.medicineName || '').trim();
      const quantity = Number(input.quantity);
      if (!medicineName) throw new Error('Medicine name is required.');
      if (!Number.isFinite(quantity) || quantity < 1) throw new Error('Quantity must be at least 1.');

      const request = new MedicineRequest({
        requestedBy: user._id,
        medicineName,
        strength: String(input.strength || '').trim(),
        quantity,
        unit: input.unit || 'Strips',
        urgency: ['LOW', 'NORMAL', 'URGENT'].includes(input.urgency) ? input.urgency : 'NORMAL',
        notes: String(input.notes || '').trim(),
        status: 'PENDING',
      });
      await request.save();
      const populated = await request.populate('requestedBy');

      // 1. Push in-app notification to all admins (removed excludeUserId so the requester gets it if they are an admin testing the system)
      await pushNotification({
        type: 'MEDICINE_REQUEST',
        adminBroadcast: true,
        title: `Stock needed: ${populated.medicineName}`,
        message: `${populated.requestedBy.name} needs ${populated.quantity} ${populated.unit.toLowerCase()} of ${populated.medicineName}${populated.strength ? ` (${populated.strength})` : ''}`,
        link: '/stock',
        meta: { medicineRequestId: String(request._id) },
      });

      // 2. Send the highly professional, structured HTML email
      import('../../services/mail.service.js').then((mail) => {
        mail.sendStockRequestEmail(populated).catch(console.error);
      });

      return populated;
    },
    /** Admin moves a request through ORDERED → SUPPLIED (or REJECTS it) */
    reviewMedicineRequest: async (_, { id, status, adminFeedback }, { user }) => {
      requireAdmin(user);
      const allowed = ['PENDING', 'ORDERED', 'SUPPLIED', 'REJECTED'];
      if (!allowed.includes(status)) throw new Error(`Invalid status "${status}".`);

      const request = await MedicineRequest.findById(id).populate('requestedBy');
      if (!request) throw new Error('Medicine request not found');

      request.status = status;
      request.adminFeedback = adminFeedback || '';
      request.handledBy = user._id;
      await request.save();
      const populated = await request.populate(['requestedBy', 'handledBy']);

      // Close the original request notification in every admin's inbox
      await Notification.updateMany(
        { type: 'MEDICINE_REQUEST', 'meta.medicineRequestId': String(request._id) },
        { isRead: true }
      ).catch(() => {});

      // Self-handled guard – reviewer never pings themselves
      const isSelf = String(populated.requestedBy._id) === String(user._id);

      if (!isSelf && status !== 'PENDING') {
        await pushNotification({
          recipientIds: [populated.requestedBy._id],
          type: 'MEDICINE_DECISION',
          title:
            status === 'SUPPLIED'
              ? `${populated.medicineName} supplied`
              : status === 'ORDERED'
                ? `${populated.medicineName} ordered`
                : `${populated.medicineName} request rejected`,
          message: adminFeedback || `Status updated to ${status}.`,
          link: '/stock',
          meta: { medicineRequestId: String(request._id) },
        });

        // Decision email via the premium branded template
        sendUserUpdateEmail(populated.requestedBy, {
          subject:
            status === 'SUPPLIED'
              ? `Stock update: ${populated.medicineName} has been supplied`
              : status === 'ORDERED'
                ? `Stock update: ${populated.medicineName} has been ordered`
                : `Stock update: ${populated.medicineName} request was not approved`,
          heading:
            status === 'SUPPLIED'
              ? 'Medicine Supplied'
              : status === 'ORDERED'
                ? 'Medicine Ordered'
                : 'Request Rejected',
          pill: STATUS_PILL[status] || null,
          introText:
            status === 'SUPPLIED'
              ? 'Good news - the requested medicine has been supplied to the shop and should now be available on the counter.'
              : status === 'ORDERED'
                ? 'The requested medicine has been ordered from the distributor and will reach the shop shortly.'
                : 'Your stock request could not be approved at this time.',
          rows: [
            ['Medicine', `<strong>${populated.medicineName}</strong>${populated.strength ? ` · ${populated.strength}` : ''}`],
            ['Quantity', `${populated.quantity} ${populated.unit}`],
            ...(adminFeedback ? [['Note From Owner', adminFeedback]] : []),
          ],
          cta: { text: 'View Stock Requests', path: '/stock' },
        }).catch(console.error);
      }

      return populated;
    },
  },
};

