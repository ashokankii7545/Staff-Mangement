import { regularizationService } from './regularization.service.js';
import { pubsub, PUBSUB_CHANNELS } from '../../shared/graphql/pubsub.js';
import { requireAuth, requireAdmin } from '../../shared/guards/auth.guard.js';
import type { RegularizationDocument } from './regularization.model.js';
import type { ContextValue } from '../../graphql/context.js';

export const regularizationResolvers = {
  Subscription: {
    regularizationAdded: {
      subscribe: () => pubsub.asyncIterableIterator([PUBSUB_CHANNELS.REGULARIZATION_ADDED]),
    },
    regularizationUpdated: {
      subscribe: () => pubsub.asyncIterableIterator([PUBSUB_CHANNELS.REGULARIZATION_UPDATED]),
    },
  },

  Query: {
    myRegularizations: async (
      _parent: unknown,
      _args: Record<string, never>,
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return regularizationService.listMine(String(user._id));
    },

    allRegularizations: async (
      _parent: unknown,
      args: { status?: string },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return regularizationService.listAll(args.status);
    },
  },

  Mutation: {
    requestRegularization: async (
      _parent: unknown,
      args: { input: Parameters<typeof regularizationService.request>[0] },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return regularizationService.request(args.input, String(user._id));
    },

    reviewRegularization: async (
      _parent: unknown,
      args: { id: string; status: string; adminFeedback?: string | null },
      ctx: ContextValue,
    ) => {
      const approver = requireAdmin(ctx.user);
      return regularizationService.review(
        args.id,
        args.status,
        args.adminFeedback,
        String(approver._id),
      );
    },
  },

  RegularizationRequest: {
    id: (parent: RegularizationDocument) =>
      parent._id ?? (parent as unknown as { id?: unknown }).id,
  },
};
