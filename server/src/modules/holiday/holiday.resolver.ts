import { holidayService } from './holiday.service.js';
import { requireAdmin } from '../../shared/guards/auth.guard.js';
import type { HolidayDocument } from './holiday.model.js';
import type { ContextValue } from '../../graphql/context.js';

export const holidayResolvers = {
  Query: {
    holidays: async (_parent: unknown, args: { year?: number }) =>
      holidayService.listByYear(args.year),
  },

  Mutation: {
    createHoliday: async (
      _parent: unknown,
      args: { input: { name: string; date: Date; description?: string; type?: 'NATIONAL' | 'OPTIONAL' } },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return holidayService.create(args.input);
    },

    deleteHoliday: async (_parent: unknown, args: { id: string }, ctx: ContextValue) => {
      requireAdmin(ctx.user);
      return holidayService.delete(args.id);
    },
  },

  Holiday: {
    id: (parent: HolidayDocument) => parent._id ?? (parent as unknown as { id?: unknown }).id,
  },
};
