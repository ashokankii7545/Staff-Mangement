import mongoose from 'mongoose';

// ── STAFF DOCUMENT VAULT ────────────────────────────────────────────────────
// Optional uploads (ID proof, certificates). Admin verifies; nothing here is
// mandatory for attendance. Lifecycle: PENDING → VERIFIED / REJECTED.
const documentSchema = new mongoose.Schema({
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  category: { type: String, enum: ['ID_PROOF', 'CERTIFICATE', 'OTHER'], default: 'OTHER' },
  fileUrl: { type: String, required: true },
  status: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING' },
  adminFeedback: { type: String, trim: true, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

documentSchema.index({ uploadedBy: 1, createdAt: -1 });
documentSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('StaffDocument', documentSchema);