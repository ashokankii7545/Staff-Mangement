import type { WithId } from '../../shared/repository/base-repository.js';
import type { OfficeRow } from '../../db/schema/office.schema.js';

/**
 * Office types – now backed by Postgres/Drizzle (not Mongoose).
 * `IOffice` is the plain column shape; `OfficeDocument` adds the `_id`
 * compatibility alias so existing service/resolver/loader code is unchanged.
 */
export interface IOffice {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/** A hydrated office row as returned by the repository (id + _id + columns). */
export type OfficeDocument = WithId<OfficeRow>;
