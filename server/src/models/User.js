import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, minlength: 6 },
  role: { type: String, enum: ['STAFF', 'ADMIN'], default: 'STAFF' },
  department: { type: String, trim: true, default: 'General' },
  assignedOffice: { type: mongoose.Schema.Types.ObjectId, ref: 'Office', default: null },
  avatar: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  // Self-signup approval workflow – admin-created users are APPROVED instantly,
  // self signups (password or first-time Google) start as PENDING.
  approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'APPROVED' },
  approvalNote: { type: String, default: '' },
  // UI preference synced across devices/re-logins
  themePreference: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
  // Per-account page restrictions managed by admins. EMPTY array (default)
  // means EVERY page is accessible – admins withdraw specific pages by
  // adding their route keys here (e.g. ['/approvals', '/settings']).
  restrictedPages: { type: [String], default: [] },
  // Google OAuth
  googleId: { type: String, default: '' },
  loginMethod: { type: String, enum: ['PASSWORD', 'GOOGLE'], default: 'PASSWORD' },
  // Temporary duty reassignment – overrides assignedOffice between dates
  // without touching the permanent assignment. Cleared automatically by date check.
  temporaryAssignment: {
    office: { type: mongoose.Schema.Types.ObjectId, ref: 'Office', default: null },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    reason: { type: String, default: '' },
  },
  leaveBalances: {
    casual: { type: Number, default: 12 },
    sick: { type: Number, default: 6 },
    earned: { type: Number, default: 0 }
  },
  shiftStartTime: { type: String, default: '' },
  shiftEndTime: { type: String, default: '' }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
