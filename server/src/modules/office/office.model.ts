import mongoose, { Schema, type Model } from 'mongoose';

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

export type OfficeDocument = mongoose.HydratedDocument<IOffice>;

const officeSchema = new Schema<IOffice>(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true, default: '' },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    geofenceRadius: { type: Number, default: 200 }, // meters
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const OfficeModel: Model<IOffice> =
  (mongoose.models.Office as Model<IOffice>) || mongoose.model<IOffice>('Office', officeSchema);
