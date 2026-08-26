import { leaveService } from './leave.service.js';
import { pubsub, PUBSUB_CHANNELS } from '../../shared/graphql/pubsub.js';
import { requireAuth, requireAdmin } from '../../shared/guards/auth.guard.js';
import type { LeaveRequestDocument } from './leave.model.js';
import type { ContextValue } from '../../graphql/context.js';

export const leaveResolvers = {
  Subscription: {
    leaveRequestAdded: {
      subscribe: () => pubsub.asyncIterableIterator([PUBSUB_CHANNELS.LEAVE_REQUEST_ADDED]),
    },
    leaveRequestUpdated: {
      subscribe: () => pubsub.asyncIterableIterator([PUBSUB_CHANNELS.LEAVE_REQUEST_UPDATED]),
    },
  },

  Query: {
    myLeaveRequests: async (_parent: unknown, _args: Record<string, never>, ctx: ContextValue) => {
      const user = requireAuth(ctx.user);
      return leaveService.listMine(String(user._id));
    },

    allLeaveRequests: async (
      _parent: unknown,
      args: { status?: string },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return leaveService.listAll(args.status);
    },

    pendingApprovalsCount: async (
      _parent: unknown,
      _args: Record<string, never>,
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return leaveService.pendingApprovalsCount();
    },
  },

  Mutation: {
    applyForLeave: async (
      _parent: unknown,
      args: { input: Parameters<typeof leaveService.apply>[0] },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return leaveService.apply(args.input, {
        id: String(user._id),
        role: user.role,
      });
    },

    /** Staff withdraws their OWN pending/approved leave – admin is always informed */
    cancelMyLeave: async (_parent: unknown, args: { id: string }, ctx: ContextValue) => {
      const user = requireAuth(ctx.user);
      return leaveService.cancelMine(args.id, String(user._id));
    },

    reviewLeaveRequest: async (
      _parent: unknown,
      args: { id: string; status: string; adminFeedback?: string | null },
      ctx: ContextValue,
    ) => {
      const approver = requireAdmin(ctx.user);
      return leaveService.review(args.id, args.status, args.adminFeedback, {
        id: String(approver._id),
      });
    },
  },

  LeaveRequest: {
    id: (parent: LeaveRequestDocument) =>
      parent._id ?? (parent as unknown as { id?: unknown }).id,
  },
};
