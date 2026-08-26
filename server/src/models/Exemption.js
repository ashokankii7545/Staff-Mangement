import mongoose from 'mongoose';

/**
 * Day-off exemption – admin grants a specific staff member a paid/free day.
 * Exempted days are excluded from "absent" counts and shown as EXEMPT status.
 */
const exemptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    reason: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

exemptionSchema.index({ user: 1, date: 1 }, { unique: true });

export default mongoose.model('Exemption', exemptionSchema);
