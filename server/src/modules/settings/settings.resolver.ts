import { settingsService } from './settings.service.js';
import { requireAuth, requireAdmin } from '../../shared/guards/auth.guard.js';
import type { SettingsDocument } from './settings.model.js';
import type { ContextValue } from '../../graphql/context.js';

export const settingsResolvers = {
  Query: {
    settings: async (_parent: unknown, _args: Record<string, never>, ctx: ContextValue) => {
      requireAuth(ctx.user);
      return settingsService.getOrCreate();
    },
  },

  Mutation: {
    updateSettings: async (
      _parent: unknown,
      args: { input: Record<string, unknown> },
      ctx: ContextValue,
    ) => {
      const actor = requireAdmin(ctx.user);
      return settingsService.update(args.input, actor.name);
    },
  },

  Settings: {
    id: (parent: SettingsDocument) =>
      parent._id ?? (parent as unknown as { id?: unknown }).id,
  },
};
