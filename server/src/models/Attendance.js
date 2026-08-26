import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  accuracy: { type: Number },
  address: { type: String, default: '' },
  withinGeofence: { type: Boolean, default: false },
  distanceFromOffice: { type: Number, default: 0 },
  branchName: { type: String, default: '' },
  isCoverDuty: { type: Boolean, default: false },
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  punchedOffice: { type: mongoose.Schema.Types.ObjectId, ref: 'Office' },
  isCoverDuty: { type: Boolean, default: false },
  type: { type: String, enum: ['CLOCK_IN', 'CLOCK_OUT'], required: true },
  selfieUrl: { type: String, required: true },
  location: { type: locationSchema, required: true },
  ipAddress: { type: String, default: '' },
  vpnDetected: { type: Boolean, default: false },
  vpnCheckDetails: {
    vpn: { type: Boolean, default: false },
    proxy: { type: Boolean, default: false },
    tor: { type: Boolean, default: false },
    webrtcMismatch: { type: Boolean, default: false },
    timezoneMismatch: { type: Boolean, default: false },
  },
  browserTimezone: { type: String, default: '' },
  date: { type: String, required: true }, // YYYY-MM-DD for easy daily querying
  approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adminComments: { type: String, trim: true },
  // Face identity check (client-side face-api descriptor distance vs profile avatar).
  // faceMatched === false forces the punch into the admin review queue.
  faceMatched: { type: Boolean },
  faceMatchScore: { type: Number }, // Euclidean distance – lower = closer match
}, { timestamps: true });

// Compound index for fast daily lookups
attendanceSchema.index({ user: 1, date: 1, type: 1 });
attendanceSchema.index({ date: 1 });

export default mongoose.model('Attendance', attendanceSchema);
