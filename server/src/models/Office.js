import mongoose from 'mongoose';

const officeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, trim: true, default: '' },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  geofenceRadius: { type: Number, default: 200 }, // meters
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('Office', officeSchema);
