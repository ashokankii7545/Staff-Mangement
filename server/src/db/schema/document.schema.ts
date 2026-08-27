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
