import {
  loginUser,
  googleLogin,
  registerStaff,
  signupUser,
  reviewUserSignup,
  changeUserPassword,
} from '../../services/auth.service.js';
import { requireAdmin } from '../../middleware/auth.js';
import User from '../../models/User.js';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '../../services/mail.service.js';

export default {
  Query: {
    checkAvatar: async (_, { identifier }) => {
      const user = await User.findOne({ $or: [{ email: identifier.toLowerCase() }, { employeeId: identifier }] });
      return user?.avatar || null;
    }
  },
  Mutation: {
    login: async (_, { employeeId, password }, ctx) => {
      return loginUser({ employeeId, password, ip: ctx.clientIp });
    },
    googleLogin: async (_, { credential }, ctx) => {
      return googleLogin({ credential, ip: ctx.clientIp });
    },
        requestPasswordReset: async (_, { email }) => {
      console.log(`Password reset requested for email: ${email}`);
      const resetToken = crypto.randomUUID();
      await sendPasswordResetEmail(email, resetToken);
      return true;
    },
    registerStaff: async (_, { input }, { user }) => {
      requireAdmin(user);
      return registerStaff(input);
    },
    /** Public self-signup – account stays PENDING until an admin approves it */
    signup: async (_, { input }, ctx) => {
      return signupUser({ ...input, ip: ctx.clientIp });
    },
    reviewUserSignup: async (_, { id, status, note, officeId }, { user }) => {
      requireAdmin(user);
      return reviewUserSignup(id, status, note, officeId);
    },
    /** Logged-in user rotates their own password (Google-only accounts may set one) */
    changePassword: async (_, { currentPassword, newPassword }, { user }) => {
      const { requireAuth } = await import('../../middleware/auth.js');
      requireAuth(user);
      return changeUserPassword({ userId: user._id, currentPassword, newPassword });
    },
  },
};
