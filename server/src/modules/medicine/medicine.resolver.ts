import { ValidationError } from '../../shared/errors/app.errors.js';
import { medicineService } from '../medicine/medicine.service.js';
import { requireAuth, requireAdmin } from '../../shared/guards/auth.guard.js';
import type { ContextValue } from '../../graphql/context.js';

/** Medicine module resolvers (kept beside the medicine service). */
export const medicineResolvers = {
  Query: {
    myMedicineRequests: async (
      _parent: unknown,
      _args: Record<string, never>,
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return medicineService.listMine(String(user._id));
    },

    allMedicineRequests: async (
      _parent: unknown,
      args: { status?: string },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return medicineService.listAll(args.status);
    },

    /** Master catalogue search – staff get active-only, admins can see all. */
    medicines: async (
      _parent: unknown,
      args: { search?: string; includeInactive?: boolean },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      const isAdmin = user.role === 'ADMIN';
      if (!isAdmin && args.includeInactive) {
        throw new ValidationError('Only admins can view deactivated medicines.');
      }
      return medicineService.listMedicines(args.search, !!args.includeInactive, isAdmin);
    },
  },

  Mutation: {
    /** Staff flags a missing / short medicine → lands in the admin's inbox */
    requestMedicine: async (
      _parent: unknown,
      args: { input: Parameters<typeof medicineService.request>[0] },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return medicineService.request(args.input, String(user._id));
    },

    /** Admin moves a request through ORDERED → SUPPLIED (or REJECTS it) */
    reviewMedicineRequest: async (
      _parent: unknown,
      args: { id: string; status: string; adminFeedback?: string | null },
      ctx: ContextValue,
    ) => {
      const handler = requireAdmin(ctx.user);
      return medicineService.review(args.id, args.status, args.adminFeedback, {
        id: String(handler._id),
      });
    },

    /** Admin adds a medicine to the master catalogue */
    createMedicine: async (
      _parent: unknown,
      args: { input: Parameters<typeof medicineService.createMedicine>[0] },
      ctx: ContextValue,
    ) => {
      const admin = requireAdmin(ctx.user);
      return medicineService.createMedicine(args.input, String(admin._id));
    },

    /** Admin edits a catalogue entry */
    updateMedicine: async (
      _parent: unknown,
      args: { id: string; input: Parameters<typeof medicineService.updateMedicine>[1] },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return medicineService.updateMedicine(args.id, args.input);
    },

    /** Admin soft-deletes a catalogue entry (hidden from staff search) */
    removeMedicine: async (
      _parent: unknown,
      args: { id: string },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return medicineService.removeMedicine(args.id);
    },

    /** Admin re-activates a previously removed medicine */
    restoreMedicine: async (
      _parent: unknown,
      args: { id: string },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return medicineService.restoreMedicine(args.id);
    },
  },
};
