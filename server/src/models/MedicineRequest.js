import mongoose from 'mongoose';

// ── MEDICINE STOCK REQUESTS ─────────────────────────────────────────────────
// Pharmacy workflow: staff flags medicines that are out-of-stock / short,
// so the owner (admin) can plan purchasing.
// Lifecycle: PENDING → ORDERED → SUPPLIED (or REJECTED).
const medicineRequestSchema = new mongoose.Schema({
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  medicineName: { type: String, required: true, trim: true },
  strength: { type: String, trim: true, default: '' }, // e.g. "500mg", "10ml"
  quantity: { type: Number, required: true, min: 1 },
  unit: { type: String, enum: ['Strips', 'Bottles', 'Units', 'Boxes'], default: 'Strips' },
  urgency: { type: String, enum: ['LOW', 'NORMAL', 'URGENT'], default: 'NORMAL' },
  notes: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['PENDING', 'ORDERED', 'SUPPLIED', 'REJECTED'], default: 'PENDING' },
  adminFeedback: { type: String, trim: true, default: '' },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

medicineRequestSchema.index({ status: 1, createdAt: -1 });
medicineRequestSchema.index({ requestedBy: 1, createdAt: -1 });

export default mongoose.model('MedicineRequest', medicineRequestSchema);
