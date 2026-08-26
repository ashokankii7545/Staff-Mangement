import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  description: { type: String, trim: true },
  type: { type: String, enum: ['NATIONAL', 'OPTIONAL'], default: 'NATIONAL' },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

const Holiday = mongoose.model('Holiday', holidaySchema);
export default Holiday;
