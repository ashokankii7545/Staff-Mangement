import { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { useInterval } from 'ahooks';

/**
 * useClock – Live ticking clock built on dayjs + ahooks `useInterval`.
 *
 * Returns the live dayjs object plus pre-formatted strings and granular
 * parts so widgets (ClockWidget etc.) never re-implement formatting.
 *
 * @param {number} [tickMs=1000] - Update interval in ms
 * @returns {{ time: dayjs.Dayjs, formattedTime: string, formattedDate: string,
 *   hours: string, minutes: string, seconds: string, period: string }}
 */
export const useClock = (tickMs = 1000) => {
  const [now, setNow] = useState(() => dayjs());

  // ahooks useInterval – always-fresh closures, no stale-state pitfalls
  useInterval(() => setNow(dayjs()), tickMs);

  return useMemo(
    () => ({
      time: now,
      formattedTime: now.format('hh:mm:ss A'),
      formattedDate: now.format('dddd, DD MMMM YYYY'),
      hours: now.format('hh'),
      minutes: now.format('mm'),
      seconds: now.format('ss'),
      period: now.format('A'),
    }),
    [now]
  );
};

export default useClock;
