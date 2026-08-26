import dayjs from 'dayjs';

/** Today as `YYYY-MM-DD` – the canonical attendance day key. */
export const todayISO = (): string => dayjs().format('YYYY-MM-DD');

export const toISODate = (value: dayjs.ConfigType): string => dayjs(value).format('YYYY-MM-DD');

export const startOfCurrentMonthISO = (): string => dayjs().startOf('month').format('YYYY-MM-DD');

export const daysAgoISO = (days: number): string => dayjs().subtract(days, 'day').format('YYYY-MM-DD');

export const monthStartISO = (month: number, year: number): string =>
  dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('YYYY-MM-DD');

export const monthEndISO = (month: number, year: number): string =>
  dayjs(monthStartISO(month, year)).endOf('month').format('YYYY-MM-DD');

export const daysBetweenInclusive = (
  start: dayjs.ConfigType,
  end: dayjs.ConfigType,
): number =>
  Math.round(
    (new Date(end as string | number | Date).getTime() -
      new Date(start as string | number | Date).getTime()) /
      (1000 * 60 * 60 * 24),
  ) + 1;

export { dayjs };
