import { webauthnService } from './webauthn.service.js';
import { requireAuth, requireAdmin } from '../../shared/guards/auth.guard.js';
import type { IUserDocument } from '../user/user.model.js';
import type { ContextValue } from '../../graphql/context.js';

export const webauthnResolvers = {
  Mutation: {
    /** Ceremony #1a – create registration options for the staff member's phone. */
    beginFingerprintRegistration: async (
      _parent: unknown,
      _args: Record<string, never>,
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return webauthnService.beginRegistration(user, { rpId: ctx.hostname, origin: ctx.origin });
    },

    /** Ceremony #1b – verify the phone's attestation and persist the passkey. */
    completeFingerprintRegistration: async (
      _parent: unknown,
      args: { responseJson: string },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return webauthnService.completeRegistration(user, args.responseJson, { rpId: ctx.hostname, origin: ctx.origin });
    },

    /** Ceremony #2a – create punch-time authentication options (challenge). */
    beginFingerprintAuthentication: async (
      _parent: unknown,
      _args: Record<string, never>,
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return webauthnService.beginAuthentication(user, { rpId: ctx.hostname, origin: ctx.origin });
    },

    /** Staff self-service: forget a specific device credential. */
    removeFingerprint: async (
      _parent: unknown,
      args: { credentialId: string },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      const passkeys = await webauthnService.removePasskey(user, args.credentialId);
      return { success: true, message: 'Fingerprint removed.', passkeys };
    },

    /** Admin: send a "register your fingerprint" reminder email to a staff member. */
    requestFingerprintRegistration: async (
      _parent: unknown,
      args: { userId: string },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return webauthnService.requestRegistrationEmail(args.userId);
    },

    /** Admin: remove a specific device credential from any staff member. */
    adminRemoveFingerprint: async (
      _parent: unknown,
      args: { userId: string; credentialId: string },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      const passkeys = await webauthnService.adminRemovePasskey(args.userId, args.credentialId);
      return { success: true, message: 'Fingerprint removed by admin.', passkeys };
    },
  },

  User: {
    passkeys: (parent: IUserDocument) => webauthnService.summarize(parent),
  },
};
