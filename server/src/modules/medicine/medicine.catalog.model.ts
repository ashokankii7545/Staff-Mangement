import type { WithId } from '../../shared/repository/base-repository.js';
import type { MedicineCatalogRow } from '../../db/schema/medicine-catalog.schema.js';

/**
 * Master catalogue entry for a medicine – backed by Postgres/Drizzle.
 * Field set mirrors Indian retail-pharmacy item masters.
 */
export interface IMedicineCatalog {
  name: string;
  genericName: string;
  manufacturer: string;
  dosageForm: string;
  strength: string;
  packSize: string;
  category: string;
  schedule: string;
  uses: string;
  dosageTiming: string;
  directionsForUse: string;
  storage: string;
  sideEffects: string;
  image: string;
  price: number;
  purchaseRate: number;
  gstRate: number;
  isActive: boolean;
  createdBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type MedicineCatalogDocument = WithId<MedicineCatalogRow>;
