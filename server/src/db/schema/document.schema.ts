import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { users } from './user.schema.js';

/** Staff document vault (old Mongo `StaffDocument` collection). */
export const documents = pgTable(
  'documents',
  {
    id: primaryId(),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    category: text('category').notNull().default('OTHER'), // ID_PROOF | CERTIFICATE | OTHER
    fileUrl: text('file_url').notNull(),
    status: text('status').notNull().default('PENDING'), // PENDING | VERIFIED | REJECTED
    adminFeedback: text('admin_feedback').notNull().default(''),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => ({
    uploaderIdx: index('documents_uploaded_by_idx').on(t.uploadedBy),
    statusIdx: index('documents_status_idx').on(t.status),
  }),
);

export type DocumentRow = typeof documents.$inferSelect;
export type NewDocumentRow = typeof documents.$inferInsert;

/**
 * Admin → staff document requests ("please upload your ID proof").
 * Admin asks; the staff member sees the request, uploads the document and the
 * request is auto-fulfilled when a matching document is uploaded.
 */
export const documentRequests = pgTable(
  'document_requests',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: text('category').notNull().default('OTHER'), // ID_PROOF | CERTIFICATE | OTHER
    note: text('note').notNull().default(''),
    status: text('status').notNull().default('PENDING'), // PENDING | FULFILLED | CANCELLED
    requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
    fulfilledDocumentId: uuid('fulfilled_document_id').references(() => documents.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (t) => ({
    userStatusIdx: index('document_requests_user_status_idx').on(t.userId, t.status),
  }),
);

export type DocumentRequestRow = typeof documentRequests.$inferSelect;
export type NewDocumentRequestRow = typeof documentRequests.$inferInsert;
