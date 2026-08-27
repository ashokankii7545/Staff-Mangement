import crypto from 'crypto';
import { authService } from './auth.service.js';
import { requireAdmin, requireAuth } from '../../shared/guards/auth.guard.js';
import { mailService } from '../../shared/mail/mail.service.js';
import type { ContextValue } from '../../graphql/context.js';

export const authResolvers = {
  Query: {
    checkAvatar: async (_parent: unknown, args: { identifier: string }) =>
      authService.checkAvatar(args.identifier),
  },

  Mutation: {
    login: async (
      _parent: unknown,
      args: { employeeId: string; password: string },
      ctx: ContextValue,
    ) => authService.loginUser({ ...args, ip: ctx.clientIp }),

    googleLogin: async (_parent: unknown, args: { credential: string }, ctx: ContextValue) =>
      authService.googleLogin({ credential: args.credential, ip: ctx.clientIp }),

    requestPasswordReset: async (_parent: unknown, args: { email: string }) =>
      authService.requestPasswordReset(args.email),

    registerStaff: async (
      _parent: unknown,
      args: { input: Parameters<typeof authService.registerStaff>[0] },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return authService.registerStaff(args.input);
    },

    /** Public self-signup – account stays PENDING until an admin approves it */
    signup: async (
      _parent: unknown,
      args: { input: { name: string; email: string; password: string; avatarBase64?: string | null } },
      ctx: ContextValue,
    ) => authService.signupUser({ ...args.input, ip: ctx.clientIp }),

    verifyEmailOTP: async (_parent: unknown, args: { email: string; otp: string }) => 
      authService.verifyEmailOTP(args.email, args.otp),

    resendEmailOTP: async (_parent: unknown, args: { email: string }) => 
      authService.resendEmailOTP(args.email),

    reviewUserSignup: async (
      _parent: unknown,
      args: { id: string; status: string; note?: string | null; officeId?: string | null },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return authService.reviewUserSignup(args.id, args.status, args.note, args.officeId);
    },

    /** Logged-in user rotates their own password (Google-only accounts may set one) */
    changePassword: async (
      _parent: unknown,
      args: { currentPassword?: string | null; newPassword: string },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return authService.changeUserPassword({
        userId: String(user._id),
        currentPassword: args.currentPassword,
        newPassword: args.newPassword,
      });
    },
  },
};
