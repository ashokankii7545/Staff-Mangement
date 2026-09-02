import dayjs from 'dayjs';
import { attendanceService } from './attendance.service.js';
import { requireAuth, requireAdmin } from '../../shared/guards/auth.guard.js';
import type { ContextValue } from '../../graphql/context.js';

const startOfMonth = () => dayjs().startOf('month').format('YYYY-MM-DD');
const today = () => dayjs().format('YYYY-MM-DD');

export const attendanceResolvers = {
  Query: {
    myAttendance: async (
      _parent: unknown,
      args: { startDate?: string; endDate?: string },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return attendanceService.getSummary({
        userId: String(user._id),
        startDate: args.startDate || startOfMonth(),
        endDate: args.endDate || today(),
      });
    },

    allAttendance: async (
      _parent: unknown,
      args: { startDate?: string; endDate?: string; userId?: string },
      ctx: ContextValue,
    ) => {
      requireAdmin(ctx.user);
      return attendanceService.getSummary({
        userId: args.userId ?? null,
        startDate: args.startDate || startOfMonth(),
        endDate: args.endDate || today(),
        allUsers: !args.userId,
      });
    },

    dashboardStats: async (_parent: unknown, _args: Record<string, never>, ctx: ContextValue) => {
      requireAuth(ctx.user);
      return attendanceService.getDashboardStats();
    },

    todayStatus: async (_parent: unknown, _args: Record<string, never>, ctx: ContextValue) => {
      const user = requireAuth(ctx.user);
      const summaries = await attendanceService.getSummary({
        userId: String(user._id),
        startDate: today(),
        endDate: today(),
      });
      return summaries[0] ?? null;
    },

    weeklyAttendance: async (_parent: unknown, _args: Record<string, never>, ctx: ContextValue) => {
      const user = requireAuth(ctx.user);
      return attendanceService.getSummary({
        userId: String(user._id),
        startDate: dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
        endDate: today(),
      });
    },

    monthlyTrend: async (
      _parent: unknown,
      args: { month: number; year: number },
      ctx: ContextValue,
    ) => {
      requireAuth(ctx.user);
      return attendanceService.getMonthlyTrend(args.month, args.year);
    },

    recentActivity: async (
      _parent: unknown,
      args: { limit?: number },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      const filter =
        user.role === 'ADMIN' ? {} : ({ user: user._id } as Record<string, unknown>);
      return attendanceService.recentActivity(filter, args.limit ?? 10);
    },
  },

  Mutation: {
    clockIn: async (
      _parent: unknown,
      args: { input: Parameters<typeof attendanceService.processPunch>[0]['input'] },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return attendanceService.processPunch({
        userId: String(user._id),
        type: 'CLOCK_IN',
        input: args.input,
        ipAddress: ctx.clientIp,
        clientContext: { rpId: ctx.hostname, origin: ctx.origin }
      });
    },

    clockOut: async (
      _parent: unknown,
      args: { input: Parameters<typeof attendanceService.processPunch>[0]['input'] },
      ctx: ContextValue,
    ) => {
      const user = requireAuth(ctx.user);
      return attendanceService.processPunch({
        userId: String(user._id),
        type: 'CLOCK_OUT',
        input: args.input,
        ipAddress: ctx.clientIp,
        clientContext: { rpId: ctx.hostname, origin: ctx.origin }
      });
    },

    reviewAttendance: async (
      _parent: unknown,
      args: { id: string; status: string; adminComments?: string | null },
      ctx: ContextValue,
    ) => {
      const reviewer = requireAdmin(ctx.user);
      return attendanceService.reviewPunch({
        id: args.id,
        status: args.status,
        adminComments: args.adminComments,
        reviewer: { id: String(reviewer._id) },
      });
    },
  },
};
