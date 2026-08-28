import { userService } from './user.service.js';
import { requireAdmin, requireAuth } from '../../shared/guards/auth.guard.js';
import type { IUserDocument } from './user.model.js';
import type { ContextValue } from '../../graphql/context.js';

export const userResolvers = {
  Query: {
    me: async (_parent: unknown, _args: Record<string, never>, ctx: ContextValue) => {
      const user = requireAuth(ctx.user);
      return userService.me(String(user._id));
    },

    users: async (
      _parent: unknown,
      args: { pagination?: { page?: number; limit?: number; search?: string }; isActive?: boolean },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return userService.listUsersPaginated(args.pagination, args.isActive);
    },

    user: async (_parent: unknown, args: { id: string }, ctx: ContextValue) => {
      requireAdmin(ctx.user);
      return userService.getUser(args.id);
    },

    /** Self-signups waiting for an admin decision */
    pendingUsers: async (_parent: unknown, _args: Record<string, never>, ctx: ContextValue) => {
      requireAdmin(ctx.user);
      return userService.listPendingUsers();
    },

    /** Day-off exemptions in a date range (admin) */
    exemptions: async (
      _parent: unknown,
      args: { startDate?: string; endDate?: string },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return userService.listDayOffs(args);
    },
  },

  Mutation: {
    updateUser: async (
      _parent: unknown,
      args: { id: string; input: Parameters<typeof userService.updateUser>[1] },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return userService.updateUser(args.id, args.input);
    },

    toggleUserActive: async (
      _parent: unknown,
      args: { userId: string },
      ctx: ContextValue,
    ) => {
      const actor = requireAdmin(ctx.user);
      return userService.toggleActive(args.userId, String(actor._id));
    },

    /** Admin: set a staff member's salary. */
    updateSalary: async (
      _parent: unknown,
      args: { userId: string; input: Parameters<typeof userService.updateSalary>[1] },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return userService.updateSalary(args.userId, args.input);
    },

    /** Admin: set a staff member's bonus. */
    updateBonus: async (
      _parent: unknown,
      args: { userId: string; input: Parameters<typeof userService.updateBonus>[1] },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return userService.updateBonus(args.userId, args.input);
    },

    /** Admin "Ask Doc": request a named document from a staff member. */
    requestDocument: async (
      _parent: unknown,
      args: { userId: string; title: string; note?: string | null },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return userService.requestDocument(args.userId, args.title, args.note);
    },

    /** Persist the UI theme so it follows the user across devices & re-logins */
    setThemePreference: async (
      _parent: unknown,
      args: { mode: string },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return userService.setThemePreference(String(user._id), args.mode);
    },

    /**
     * TEMPORARY duty reassignment ?" staff can punch at another site between
     * dates WITHOUT touching their permanent assignment.
     */
    assignTemporaryDuty: async (
      _parent: unknown,
      args: { userId: string; officeId: string; startDate: Date; endDate: Date; reason?: string | null },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return userService.assignTemporaryDuty(args);
    },

    clearTemporaryDuty: async (
      _parent: unknown,
      args: { userId: string },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return userService.clearTemporaryDuty(args.userId);
    },

    /** Grant a staff member a day off on a specific date */
    grantDayOff: async (
      _parent: unknown,
      args: { userId: string; date: Date; reason?: string | null },
      ctx: ContextValue,
    ) => {
      const actor = requireAdmin(ctx.user);
      return userService.grantDayOff({
        userId: args.userId,
        date: new Date(args.date).toISOString().slice(0, 10),
        reason: args.reason,
        actorId: String(actor._id),
      });
    },

    revokeDayOff: async (_parent: unknown, args: { id: string }, ctx: ContextValue) => {
      requireAdmin(ctx.user);
      return userService.revokeDayOff(args.id);
    },

    broadcastEmail: async (
      _parent: unknown,
      args: { subject: string; message: string },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return userService.broadcast(args.subject, args.message);
    },
  },

  User: {
    id: (parent: IUserDocument) => parent._id ?? parent.id,
    assignedOffice: (parent: IUserDocument, _args: unknown, ctx: ContextValue) => {
      const ref = parent.assignedOffice;
      if (!ref) return null;
      if ((ref as unknown as { _id?: unknown })._id) return ref;
      return ctx.loaders.officeLoader.load(String(ref));
    },
    temporaryAssignment: (parent: IUserDocument, _args: unknown, ctx: ContextValue) => {
      const ta = parent.temporaryAssignment;
      if (!ta || !ta.office) return ta;
      const tOffice = ta.office;
      if ((tOffice as unknown as { _id?: unknown })._id) return ta;
      
      // Async resolution using dataloader for temporaryAssignment.office
      return (async () => {
        const loadedOffice = await ctx.loaders.officeLoader.load(String(tOffice));
        return { ...ta, office: loadedOffice };
      })();
    },
    leaveBalances: (parent: IUserDocument) => ({
      // Return exactly what is in DB; default legacy docs correctly.
      casual: parent.leaveBalances?.casual ?? 12,
      sick: parent.leaveBalances?.sick ?? 6,
      earned: parent.leaveBalances?.earned ?? 0,
    }),
    // Compensation is nullable – legacy rows return null (no salary/bonus set).
    salary: (parent: IUserDocument) =>
      (parent as unknown as { salary?: unknown }).salary ?? null,
    bonus: (parent: IUserDocument) =>
      (parent as unknown as { bonus?: unknown }).bonus ?? null,
  },

  Exemption: {
    id: (parent: { _id?: unknown; id?: unknown }) => parent._id ?? parent.id,
  },
};
