import { documentService } from './document.service.js';
import { requireAuth, requireAdmin } from '../../shared/guards/auth.guard.js';
import type { StaffDocumentModelDoc } from './document.model.js';
import type { ContextValue } from '../../graphql/context.js';

export const documentResolvers = {
  Query: {
    myDocuments: async (_parent: unknown, _args: Record<string, never>, ctx: ContextValue) => {
      const user = requireAuth(ctx.user);
      return documentService.listMine(String(user._id));
    },

    allDocuments: async (_parent: unknown, _args: Record<string, never>, ctx: ContextValue) => {
      requireAdmin(ctx.user);
      return documentService.listAll();
    },
  },

  Mutation: {
    /** Staff uploads a document for verification – always OPTIONAL */
    uploadDocument: async (
      _parent: unknown,
      args: { input: Parameters<typeof documentService.upload>[0] },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return documentService.upload(args.input, String(user._id));
    },

    deleteMyDocument: async (_parent: unknown, args: { id: string }, ctx: ContextValue) => {
      const user = requireAuth(ctx.user);
      return documentService.deleteMine(args.id, String(user._id));
    },

    reviewDocument: async (
      _parent: unknown,
      args: { id: string; status: string; adminFeedback?: string | null },
      ctx: ContextValue,
    ) => {
      const reviewer = requireAdmin(ctx.user);
      return documentService.review(args.id, args.status, args.adminFeedback, {
        id: String(reviewer._id),
      });
    },
  },

  StaffDocument: {
    id: (parent: StaffDocumentModelDoc) =>
      parent._id ?? (parent as unknown as { id?: unknown }).id,
  },
};
