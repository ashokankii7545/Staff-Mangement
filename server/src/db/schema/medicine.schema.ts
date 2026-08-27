import { boolean, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { users } from './user.schema.js';
import { medicineCatalog } from './medicine-catalog.schema.js';

/** Pharmacy stock requests raised by staff (old Mongo `MedicineRequest`). */
export const medicineRequests = pgTable(
  'medicine_requests',
  {
    id: primaryId(),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    medicineName: text('medicine_name').notNull(),
    strength: text('strength').notNull().default(''),
    quantity: integer('quantity').notNull(),
    unit: text('unit').notNull().default('Strips'),
    urgency: text('urgency').notNull().default('NORMAL'),
    notes: text('notes').notNull().default(''),
    status: text('status').notNull().default('PENDING'), // PENDING | ORDERED | SUPPLIED | REJECTED
    adminFeedback: text('admin_feedback').notNull().default(''),
    catalogMedicine: uuid('catalog_medicine').references(() => medicineCatalog.id, {
      onDelete: 'set null',
    }),
    isNewMedicine: boolean('is_new_medicine').notNull().default(false),
    handledBy: uuid('handled_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => ({
    statusIdx: index('medicine_requests_status_idx').on(t.status),
    requesterIdx: index('medicine_requests_requested_by_idx').on(t.requestedBy),
  }),
);

export type MedicineRequestRow = typeof medicineRequests.$inferSelect;
export type NewMedicineRequestRow = typeof medicineRequests.$inferInsert;
