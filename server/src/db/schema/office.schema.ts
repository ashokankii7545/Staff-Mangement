import { boolean, doublePrecision, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';

/** Physical office / branch. Maps the old Mongo `Office` collection. */
export const offices = pgTable('offices', {
  id: primaryId(),
  name: text('name').notNull(),
  address: text('address').notNull().default(''),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  geofenceRadius: integer('geofence_radius').notNull().default(200), // meters
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

export type OfficeRow = typeof offices.$inferSelect;
export type NewOfficeRow = typeof offices.$inferInsert;
