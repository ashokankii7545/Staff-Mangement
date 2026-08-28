import type { WithId } from '../../shared/repository/base-repository.js';
import type { DocumentRow, DocumentRequestRow } from '../../db/schema/document.schema.js';
import type { DOCUMENT_CATEGORIES, DOCUMENT_STATUSES, REVIEWABLE_STATUSES } from '../../config/constants.js';

/** Staff document vault types – backed by Postgres/Drizzle. */
export interface IStaffDocument {
  uploadedBy: string;
  title: string;
  category: (typeof DOCUMENT_CATEGORIES)[number] | string;
  fileUrl: string;
  status: (typeof REVIEWABLE_STATUSES)[number] | (typeof DOCUMENT_STATUSES)[number] | string;
  adminFeedback: string;
  reviewedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type StaffDocumentModelDoc = WithId<DocumentRow>;

/** Admin → staff "please upload this document" request. */
export interface IDocumentRequest {
  userId: string;
  category: string;
  note: string;
  status: string; // PENDING | FULFILLED | CANCELLED
  requestedBy?: string | null;
  fulfilledDocumentId?: string | null;
}

export type DocumentRequestModelDoc = WithId<DocumentRequestRow>;
