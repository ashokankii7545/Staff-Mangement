import { officeService } from './office.service.js';
import { requireAdmin } from '../../shared/guards/auth.guard.js';
import type { ContextValue } from '../../graphql/context.js';

export const officeResolvers = {
  Query: {
    offices: () => officeService.listActive(),
    office: async (_parent: unknown, args: { id: string }) => officeService.getById(args.id),
  },

  Mutation: {
    createOffice: async (
      _parent: unknown,
      args: { input: Parameters<typeof officeService.create>[0] },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return officeService.create(args.input);
    },

    updateOffice: async (
      _parent: unknown,
      args: { id: string; input: Parameters<typeof officeService.update>[1] },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return officeService.update(args.id, args.input);
    },

    /** Soft delete */
    deleteOffice: async (_parent: unknown, args: { id: string }, ctx: ContextValue) => {
      requireAdmin(ctx.user);
      return officeService.softDelete(args.id);
    },
  },
};
