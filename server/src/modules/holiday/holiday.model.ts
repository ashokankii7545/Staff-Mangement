import type { WithId } from '../../shared/repository/base-repository.js';
import type { HolidayRow } from '../../db/schema/holiday.schema.js';
import type { HOLIDAY_TYPES } from '../../config/constants.js';

/** Holiday types – backed by Postgres/Drizzle. */
export interface IHoliday {
  name: string;
  date: Date;
  description?: string;
  type: (typeof HOLIDAY_TYPES)[number];
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type HolidayDocument = WithId<HolidayRow>;
