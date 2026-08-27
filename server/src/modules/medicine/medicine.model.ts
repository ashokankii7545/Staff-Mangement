import type { WithId } from '../../shared/repository/base-repository.js';
import type { MedicineRequestRow } from '../../db/schema/medicine.schema.js';
import type { MEDICINE_STATUSES } from '../../config/constants.js';

/** Pharmacy stock-request types – backed by Postgres/Drizzle. */
export interface IMedicineRequest {
  requestedBy: string;
  medicineName: string;
  strength: string;
  quantity: number;
  unit: string;
  urgency: string;
  notes: string;
  status: (typeof MEDICINE_STATUSES)[number] | string;
  adminFeedback: string;
  catalogMedicine?: string | null;
  isNewMedicine: boolean;
  handledBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type MedicineRequestDocument = WithId<MedicineRequestRow>;
