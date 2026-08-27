import { boolean, doublePrecision, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { users } from './user.schema.js';

/**
 * Master medicine catalogue (old Mongo `MedicineCatalog` collection).
 * Owner/admin-maintained item master mirroring Indian retail-pharmacy fields.
 */
export const medicineCatalog = pgTable('medicine_catalog', {
  id: primaryId(),
  name: text('name').notNull(),
  genericName: text('generic_name').notNull().default(''),
  manufacturer: text('manufacturer').notNull().default(''),
  dosageForm: text('dosage_form').notNull().default(''),
  strength: text('strength').notNull().default(''),
  packSize: text('pack_size').notNull().default(''),
  category: text('category').notNull().default(''),
  schedule: text('schedule').notNull().default('OTC'),
  uses: text('uses').notNull().default(''),
  dosageTiming: text('dosage_timing').notNull().default(''),
  directionsForUse: text('directions_for_use').notNull().default(''),
  storage: text('storage').notNull().default(''),
  sideEffects: text('side_effects').notNull().default(''),
  image: text('image').notNull().default(''),
  price: doublePrecision('price').notNull().default(0),
  purchaseRate: doublePrecision('purchase_rate').notNull().default(0),
  gstRate: integer('gst_rate').notNull().default(5), // 0 | 5 | 12
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  ...timestamps,
});

export type MedicineCatalogRow = typeof medicineCatalog.$inferSelect;
export type NewMedicineCatalogRow = typeof medicineCatalog.$inferInsert;
