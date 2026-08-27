import type { WithId } from '../../shared/repository/base-repository.js';
import type { ExemptionRow } from '../../db/schema/day-off.schema.js';

/**
 * Day-off exemption types – backed by Postgres/Drizzle.
 * When populated, `user`/`createdBy` carry the related user object instead of
 * a uuid string (hence the loose typing downstream).
 */
export interface IExemption {
  user: string;
  date: string;
  reason: string;
  createdBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ExemptionDocument = WithId<ExemptionRow>;
