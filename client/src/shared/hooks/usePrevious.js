import { usePrevious as useAhooksPrevious } from 'ahooks';

/**
 * usePrevious – Returns the value from the previous render.
 *
 * Re-exported from `ahooks` (zero duplication policy).
 *
 * @param {any} value - Current value
 * @returns {any} Previous render's value (undefined on first render)
 */
export const usePrevious = useAhooksPrevious;

export default usePrevious;
