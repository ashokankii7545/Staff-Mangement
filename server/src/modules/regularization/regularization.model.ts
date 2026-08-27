import type { WithId } from '../../shared/repository/base-repository.js';
import type { RegularizationRow } from '../../db/schema/regularization.schema.js';
import type { REVIEWABLE_STATUSES } from '../../config/constants.js';

/** Punch-correction request types – backed by Postgres/Drizzle. */
export interface IRegularization {
  user: string;
  date: string;
  checkInTime: string;
  checkOutTime: string;
  reason: string;
  status: (typeof REVIEWABLE_STATUSES)[number] | string;
  adminFeedback?: string;
  approvedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type RegularizationDocument = WithId<RegularizationRow>;
