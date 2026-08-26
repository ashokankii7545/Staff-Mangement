import dayjs from 'dayjs';
import User from '../models/User.js';
import Settings from '../models/Settings.js';

// ────────────────────────────────────────────────────────────────────────────
// LEAVE ACCRUAL ENGINE – Indian-standard policy:
//   CL  → +casualPerMonth credited EVERY month (1st)
//   SL  → RESET to sickAnnual every January ("direct grant", use-it-or-lose)
//   EL  → +earnedAnnual credited every January (carry-forward friendly)
//
// Idempotent: Settings.accrualState stores which month/year was last credited,
// so restarting the server ten times a day can never double-credit anyone.
// ────────────────────────────────────────────────────────────────────────────
export const runLeaveAccrual = async () => {
  const now = dayjs();
  const monthKey = now.format('YYYY-MM');
  const yearKey = now.format('YYYY');

  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});

  const state = settings.accrualState || {};
  const policy = settings.leavePolicy || {};
  const ops = [];
  const markers = {};

  if (state.lastMonthlyCL !== monthKey) {
    const n = policy.casualPerMonth ?? 1;
    if (n > 0) {
      ops.push({
        updateMany: {
          filter: { isActive: true },
          update: { $inc: { 'leaveBalances.casual': n } },
        },
      });
    }
    markers.lastMonthlyCL = monthKey;
  }

  if (state.lastAnnualSL !== yearKey) {
    const n = policy.sickAnnual ?? 6;
    ops.push({
      updateMany: {
        filter: { isActive: true },
        update: { $set: { 'leaveBalances.sick': n } },
      },
    });
    markers.lastAnnualSL = yearKey;
  }

  if (state.lastAnnualEL !== yearKey) {
    const n = policy.earnedAnnual ?? 12;
    if (n > 0) {
      ops.push({
        updateMany: {
          filter: { isActive: true },
          update: { $inc: { 'leaveBalances.earned': n } },
        },
      });
    }
    markers.lastAnnualEL = yearKey;
  }

  if (ops.length === 0) return false; // nothing due this tick

  for (const op of ops) {
    // eslint-disable-next-line no-await-in-loop
    await User.bulkWrite([op]);
  }

  await Settings.updateOne(
    { _id: settings._id },
    {
      $set: Object.fromEntries(
        Object.entries(markers).map(([k, v]) => [`accrualState.${k}`, v])
      ),
    }
  );

  console.log(`🗓️  Leave accrual applied (${monthKey}): ${ops.length} policy operation(s)`);
  return true;
};

/** Boot-time scheduler: first pass 15s after start, then every 6 hours.
 *  Safe to run often – the state markers make every pass a no-op unless a
 *  new month/year has actually begun. */
export const startLeaveAccrualScheduler = () => {
  const tick = () =>
    runLeaveAccrual().catch((err) => console.error('Leave accrual failed:', err.message));
  setTimeout(tick, 15_000);
  setInterval(tick, 6 * 60 * 60 * 1000);
};

/** Starting balances for a NEW hire, straight from the active policy */
export const initialBalancesForNewHire = async () => {
  try {
    const s = await Settings.findOne().select('leavePolicy').lean();
    return {
      casual: s?.leavePolicy?.casualPerMonth ?? 1,
      sick: s?.leavePolicy?.sickAnnual ?? 6,
      earned: 0, // EL starts accruing with the next annual credit
    };
  } catch {
    return { casual: 1, sick: 6, earned: 0 };
  }
};