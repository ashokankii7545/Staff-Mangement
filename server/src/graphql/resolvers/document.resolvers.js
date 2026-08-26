import StaffDocument from '../../models/Document.js';
import Notification from '../../models/Notification.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { saveBase64Document } from '../../utils/fileUpload.js';
import { pushNotification, notifyAdmins } from '../../services/notification.service.js';

export default {
  Query: {
    myDocuments: async (_, __, { user }) => {
      requireAuth(user);
      return StaffDocument.find({ uploadedBy: user._id })
        .sort({ createdAt: -1 })
        .populate('uploadedBy')
        .populate('reviewedBy');
    },
    allDocuments: async (_, __, { user }) => {
      requireAdmin(user);
      return StaffDocument.find()
        .sort({ createdAt: -1 })
        .limit(300)
        .populate('uploadedBy')
        .populate('reviewedBy');
    },
  },
  Mutation: {
    /** Staff uploads a document for verification – always OPTIONAL, never blocks attendance */
    uploadDocument: async (_, { input }, { user }) => {
      requireAuth(user);

      const title = String(input.title || '').trim();
      if (!title) throw new Error('Document title is required.');

      const fileUrl = saveBase64Document(input.fileBase64, `doc_${user._id}_${Date.now()}`);

      const doc = new StaffDocument({
        uploadedBy: user._id,
        title,
        category: ['ID_PROOF', 'CERTIFICATE', 'OTHER'].includes(input.category) ? input.category : 'OTHER',
        fileUrl,
      });
      await doc.save();
      const populated = await doc.populate('uploadedBy');

      await notifyAdmins({
        type: 'DOCUMENT_UPLOADED',
        title: 'New document uploaded',
        message: `${populated.uploadedBy.name} uploaded "${title}" for verification.`,
        link: '/documents',
        meta: { documentId: String(doc._id) },
      });

      return populated;
    },

    deleteMyDocument: async (_, { id }, { user }) => {
      requireAuth(user);
      const doc = await StaffDocument.findById(id);
      if (!doc) throw new Error('Document not found.');
      if (String(doc.uploadedBy) !== String(user._id)) {
        throw new Error('You can only delete your own documents.');
      }
      if (doc.status === 'VERIFIED') {
        throw new Error('Verified documents cannot be deleted – ask the admin.');
      }
      await StaffDocument.findByIdAndDelete(id);
      await Notification.updateMany(
        { type: 'DOCUMENT_UPLOADED', 'meta.documentId': String(id) },
        { isRead: true }
      ).catch(() => {});
      return true;
    },

    reviewDocument: async (_, { id, status, adminFeedback }, { user }) => {
      requireAdmin(user);
      const doc = await StaffDocument.findById(id).populate('uploadedBy');
      if (!doc) throw new Error('Document not found.');

      doc.status = status;
      doc.adminFeedback = adminFeedback || '';
      doc.reviewedBy = user._id;
      await doc.save();
      const populated = await doc.populate('reviewedBy');

      // Close the admin's "New document uploaded" notification
      await Notification.updateMany(
        { type: 'DOCUMENT_UPLOADED', 'meta.documentId': String(doc._id) },
        { isRead: true }
      ).catch(() => {});

      // Tell the staff member the outcome
      await pushNotification({
        recipientIds: [doc.uploadedBy._id],
        type: 'DOCUMENT_DECISION',
        title: status === 'VERIFIED' ? 'Document verified' : 'Document rejected',
        message: `"${doc.title}"${adminFeedback ? ` · ${adminFeedback}` : ''}`,
        link: '/documents',
        meta: { documentId: String(doc._id) },
      });

      return populated;
    },
  },
  StaffDocument: {
    id: (parent) => parent._id || parent.id,
  },
};