import { ValidationError } from '../../shared/errors/app.errors.js';
import { saveBase64Document } from '../../shared/utils/file-upload.util.js';
import { notificationService } from '../notification/notification.service.js';
import { notificationRepository } from '../notification/notification.repository.js';
import type { StaffDocumentModelDoc } from './document.model.js';
import { documentRepository } from './document.repository.js';

export interface UploadDocumentInputShape {
  title: string;
  category?: string;
  fileBase64: string;
}

/**
 * DocumentService – SINGLETON for the staff document vault.
 */
class DocumentService {
  private static instance: DocumentService | null = null;

  private constructor() {}

  public static getInstance(): DocumentService {
    if (!DocumentService.instance) {
      DocumentService.instance = new DocumentService();
    }
    return DocumentService.instance;
  }

  public listMine(userId: string): Promise<StaffDocumentModelDoc[]> {
    return documentRepository.queries.listMine(userId);
  }

  public listAll(): Promise<StaffDocumentModelDoc[]> {
    return documentRepository.queries.listAll();
  }

  /** Staff uploads a document – always OPTIONAL, never blocks attendance. */
  public async upload(input: UploadDocumentInputShape, uploaderId: string): Promise<StaffDocumentModelDoc> {
    const title = String(input.title || '').trim();
    if (!title) throw new ValidationError('Document title is required.');

    const fileUrl = saveBase64Document(input.fileBase64, `doc_${uploaderId}_${Date.now()}`);

    const doc = await documentRepository.queries.create({
      uploadedBy: uploaderId as never,
      title,
      category:
        (['ID_PROOF', 'CERTIFICATE', 'OTHER'] as string[]).includes(input.category ?? '')
          ? (input.category as StaffDocumentModelDoc['category'])
          : 'OTHER',
      fileUrl,
    });
    await doc.populate('uploadedBy');
    const populated = doc as StaffDocumentModelDoc & { uploadedBy: { name: string } };

    await notificationService.push({
      type: 'DOCUMENT_UPLOADED',
      title: 'New document uploaded',
      message: `${populated.uploadedBy.name} uploaded "${title}" for verification.`,
      link: '/documents',
      meta: { documentId: String(doc._id) },
    });

    return populated;
  }

  public async deleteMine(id: string, ownerId: string): Promise<boolean> {
    const doc = await documentRepository.queries.findById(id);
    if (!doc) throw new ValidationError('Document not found.');
    if (String(doc.uploadedBy) !== String(ownerId)) {
      throw new ValidationError('You can only delete your own documents.');
    }
    if (doc.status === 'VERIFIED') {
      throw new ValidationError('Verified documents cannot be deleted – ask the admin.');
    }
    await documentRepository.queries.deleteById(id);
    await notificationRepository.queries.closeMetaNotifications(
      'DOCUMENT_UPLOADED',
      'documentId',
      id,
    );
    return true;
  }

  public async review(
    id: string,
    status: string,
    adminFeedback: string | null | undefined,
    reviewer: { id: string },
  ): Promise<StaffDocumentModelDoc> {
    const doc = await documentRepository.queries.findByIdPopulatedUploadedBy(id);
    if (!doc) throw new ValidationError('Document not found.');

    doc.status = status as StaffDocumentModelDoc['status'];
    doc.adminFeedback = adminFeedback || '';
    doc.reviewedBy = reviewer.id as never;
    await doc.save();
    await doc.populate('reviewedBy');
    const populated = doc as StaffDocumentModelDoc;

    // Close the admin's "New document uploaded" notification.
    await notificationRepository.queries.closeMetaNotifications(
      'DOCUMENT_UPLOADED',
      'documentId',
      String(doc._id),
    );

    // Tell the staff member the outcome.
    await notificationService.push({
      recipientIds: [String((doc.uploadedBy as unknown as { _id: unknown })._id)],
      type: 'DOCUMENT_DECISION',
      title: status === 'VERIFIED' ? 'Document verified' : 'Document rejected',
      message: `"${doc.title}"${adminFeedback ? ` · ${adminFeedback}` : ''}`,
      link: '/documents',
      meta: { documentId: String(doc._id) },
    });

    return populated;
  }
}

export const documentService = DocumentService.getInstance();
