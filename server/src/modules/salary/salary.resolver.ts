import { salaryService } from './salary.service.js';
import type { SalaryInputShape, BonusInputShape } from './salary.service.js';
import { requireAuth, requireAdmin } from '../../shared/guards/auth.guard.js';
import type { ContextValue } from '../../graphql/context.js';

export const salaryResolvers = {
  Query: {
    salaryRecords: async (
      _parent: unknown,
      args: { userId: string },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return salaryService.listSalary(args.userId, {
        id: String(user._id),
        role: String(user.role),
      });
    },

    bonusRecords: async (
      _parent: unknown,
      args: { userId: string },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return salaryService.listBonus(args.userId, {
        id: String(user._id),
        role: String(user.role),
      });
    },
  },

  Mutation: {
    /** Admin fills the salary slip form for a staff member. */
    createSalaryRecord: async (
      _parent: unknown,
      args: { userId: string; input: SalaryInputShape },
      ctx: ContextValue,
    ) => {
      const admin = requireAdmin(ctx.user);
      return salaryService.createSalary(args.userId, args.input, String(admin._id));
    },

    deleteSalaryRecord: async (_parent: unknown, args: { id: string }, ctx: ContextValue) => {
      requireAdmin(ctx.user);
      return salaryService.deleteSalary(args.id);
    },

    /** Admin records a one-time bonus for a staff member. */
    createBonusRecord: async (
      _parent: unknown,
      args: { userId: string; input: BonusInputShape },
      ctx: ContextValue,
    ) => {
      const admin = requireAdmin(ctx.user);
      return salaryService.createBonus(args.userId, args.input, String(admin._id));
    },

    deleteBonusRecord: async (_parent: unknown, args: { id: string }, ctx: ContextValue) => {
      requireAdmin(ctx.user);
      return salaryService.deleteBonus(args.id);
    },
  },
};
