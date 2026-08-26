import mongoose, { Schema, type Model } from 'mongoose';
import { DEFAULTS, HOLIDAY_TYPES } from '../../config/constants.js';

export interface IHoliday {
  name: string;
  date: Date;
  description?: string;
  type: (typeof HOLIDAY_TYPES)[number];
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type HolidayDocument = mongoose.HydratedDocument<IHoliday>;

const holidaySchema = new Schema<IHoliday>(
  {
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    description: { type: String, trim: true },
    type: { type: String, enum: [...HOLIDAY_TYPES], default: 'NATIONAL' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const HolidayModel: Model<IHoliday> =
  (mongoose.models.Holiday as Model<IHoliday>) || mongoose.model<IHoliday>('Holiday', holidaySchema);
