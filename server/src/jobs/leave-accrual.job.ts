import { leaveService } from '../modules/leave/leave.service.js';

/**
 * LEAVE ACCRUAL JOB – boot-time scheduler.
 * First pass 15s after start, then every 6 hours. Safe to run often – the
 * Settings.accrualState markers make every pass a no-op unless a new
 * month/year has actually begun.
 */
export const startLeaveAccrualScheduler = (): void => {
  const tick = () =>
    leaveService.runAccrual().catch((err) => console.error('Leave accrual failed:', err.message));

  setTimeout(tick, 15_000);
  setInterval(tick, 6 * 60 * 60 * 1000);
};
