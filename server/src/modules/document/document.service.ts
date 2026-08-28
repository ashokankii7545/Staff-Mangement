import { ValidationError } from '../../shared/errors/app.errors.js';
import { saveBase64Document } from '../../shared/utils/file-upload.util.js';
import { notificationService } from '../notification/notification.service.js';
import { notificationRepository } from '../notification/notification.repository.js';
import type { StaffDocumentModelDoc, DocumentRequestModelDoc } from './document.model.js';
import { documentRepository } from './document.repository.js';

export interface UploadDocumentInputShape {
  title: string;
  category?: string;
  fileBase64: string;
}

/**
 * What a STAFF member may upload to their own profile: personal identity/
 * qualification documents only (ID proof / certificate / other). Salary slips
 * and bonuses are FORM records managed by admins - see modules/salary.
 */
const STAFF_UPLOAD_CATEGORIES = ['ID_PROOF', 'CERTIFICATE', 'OTHER'] as const;

/** Categories an ADMIN may ask a staff member to upload. */
const REQUESTABLE_CATEGORIES = ['ID_PROOF', 'CERTIFICATE', 'OTHER'] as const;

const REQUEST_LABEL: Record<string, string> = {
  ID_PROOF: 'ID proof',
  CERTIFICATE: 'certificate',
  OTHER: 'document',
};

/**
 * DocumentService â€“ SINGLETON for the staff document vault.
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

  /** Staff uploads a document â€“ always OPTIONAL, never blocks attendance. */
  public async upload(input: UploadDocumentInputShape, uploaderId: string): Promise<StaffDocumentModelDoc> {
    const title = String(input.title || '').trim();
    if (!title) throw new ValidationError('Document title is required.');

    const fileUrl = await saveBase64Document(input.fileBase64, `doc_${uploaderId}_${Date.now()}`);

    const doc = await documentRepository.queries.create({
      uploadedBy: uploaderId as never,
      title,
      category:
        (STAFF_UPLOAD_CATEGORIES as readonly string[]).includes(input.category ?? '')
          ? (input.category as StaffDocumentModelDoc['category'])
          : 'OTHER',
      fileUrl,
    });

    // If the admin had asked for this document, mark the request fulfilled.
    await this.fulfilMatchingRequests(uploaderId, String(doc.category), String(doc._id));
    const populated = ((await documentRepository.queries.findByIdPopulatedUploadedBy(String(doc._id))) ??
      doc) as StaffDocumentModelDoc & { uploadedBy: { name: string } };

    await notificationService.notifyAdmins({
      type: 'DOCUMENT_UPLOADED',
      title: 'New document uploaded',
      message: `${populated.uploadedBy.name} uploaded "${title}" for verification.`,
      link: `/staff/${uploaderId}`,
      meta: { documentId: String(doc._id) },
    });

    return populated;
  }

  /** ADMIN asks a staff member to upload a specific document. */
  public async requestDocument(
    userId: string,
    input: { category?: string; note?: string },
    actorId: string,
  ): Promise<DocumentRequestModelDoc> {
    const category = (REQUESTABLE_CATEGORIES as readonly string[]).includes(input.category ?? '')
      ? (input.category as (typeof REQUESTABLE_CATEGORIES)[number])
      : 'OTHER';
    const note = String(input.note || '').trim();

    const row = await documentRepository.queries.createRequest({
      userId,
      category,
      note,
      status: 'PENDING',
      requestedBy: actorId,
    });

    await notificationService.push({
      recipientIds: [userId],
      type: 'GENERIC',
      title: 'Document requested',
      message: `Admin requested your ${REQUEST_LABEL[category] ?? 'document'}${note ? ` - ${note}` : ''}`,
      link: '/',
      meta: { documentRequestId: String(row._id) },
    });

    return row;
  }

  /** Requests for one staff member (self or admin). */
  public async listRequests(
    userId: string,
    requester: { id: string; role: string },
  ): Promise<DocumentRequestModelDoc[]> {
    if (requester.role !== 'ADMIN' && requester.id !== userId) {
      throw new ValidationError('You can only view your own document requests.');
    }
    return documentRepository.queries.listRequestsByUser(userId);
  }

  /** ADMIN cancels a still-pending request. */
  public async cancelRequest(id: string): Promise<boolean> {
    const row = await documentRepository.queries.findRequestById(id);
    if (!row) throw new ValidationError('Document request not found.');
    if (row.status !== 'PENDING') {
      throw new ValidationError('Only pending requests can be cancelled.');
    }
    await documentRepository.queries.updateRequestById(id, { status: 'CANCELLED' });
    return true;
  }

  /** Auto-fulfil a pending request when the staff uploads the matching document. */
  private async fulfilMatchingRequests(
    userId: string,
    category: string,
    documentId: string,
  ): Promise<void> {
    try {
      const pending = await documentRepository.queries.listRequestsByUser(userId);
      const match = pending.find((r) => r.status === 'PENDING' && r.category === category);
      if (!match) return;
      await documentRepository.queries.updateRequestById(String(match._id), {
        status: 'FULFILLED',
        fulfilledDocumentId: documentId,
      });
      await notificationService.notifyAdmins({
        type: 'DOCUMENT_UPLOADED',
        title: 'Requested document uploaded',
        message: `The ${REQUEST_LABEL[category] ?? 'document'} you asked for has been uploaded and is awaiting review.`,
        link: `/staff/${userId}`,
        meta: { documentId },
      });
    } catch {
      // Fulfilment is best-effort - it must never block the upload itself.
    }
  }

  public async deleteMine(id: string, ownerId: string): Promise<boolean> {
    const doc = await documentRepository.queries.findById(id);
    if (!doc) throw new ValidationError('Document not found.');
    if (String(doc.uploadedBy) !== String(ownerId)) {
      throw new ValidationError('You can only delete your own documents.');
    }
    if (doc.status === 'VERIFIED') {
      throw new ValidationError('Verified documents cannot be deleted â€“ ask the admin.');
    }
    await documentRepository.queries.deleteById(id);
    // If this document fulfilled an admin request, reopen the request.
    await documentRepository.queries.revertRequestByDocument(id);
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

    const populated =
      (await documentRepository.queries.updateById(String(doc._id), {
        status: status as StaffDocumentModelDoc['status'],
        adminFeedback: adminFeedback || '',
        reviewedBy: reviewer.id,
      })) ?? doc;

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
      message: `"${doc.title}"${adminFeedback ? ` Â· ${adminFeedback}` : ''}`,
      link: `/staff/${String((doc.uploadedBy as unknown as { _id: unknown })._id)}`,
      meta: { documentId: String(doc._id) },
    });

    return populated;
  }
}

export const documentService = DocumentService.getInstance();
