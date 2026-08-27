import type { WithId } from '../../shared/repository/base-repository.js';
import type { DocumentRow } from '../../db/schema/document.schema.js';
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
