import { useDebounce as useAhooksDebounce } from 'ahooks';

/**
 * useDebounce - Debounced mirror of a rapidly changing value.
 *
 * Re-exported from `ahooks` (battle-tested, SSR-safe, zero duplication).
 * Perfect for search inputs: `const debouncedSearch = useDebounce(search, { wait: 300 });`
 *
 * @param {any} value - Value to debounce
 * @param {Object} options - Options { wait: number }
 * @returns {any} The debounced value
 */
export const useDebounce = useAhooksDebounce;

export default useDebounce;
