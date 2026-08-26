import { useLocalStorageState } from 'ahooks';
import { useCallback } from 'react';

/**
 * useLocalStorage – Persistent state synced with localStorage.
 *
 * Built on `ahooks` `useLocalStorageState`, wrapped to preserve this app's
 * original `[value, setValue]` tuple API (accepts raw values or updater
 * functions) with cross-tab sync enabled.
 *
 * @param {string} key - localStorage key
 * @param {any} initialValue - Fallback when key is absent
 * @returns {[any, Function]} [storedValue, setValue]
 */
export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useLocalStorageState(key, {
    defaultValue: initialValue,
    listenStorageChange: true,
  });

  const setValue = useCallback(
    (value) => {
      setStoredValue((prev) => (value instanceof Function ? value(prev) : value));
    },
    [setStoredValue]
  );

  return [storedValue ?? initialValue, setValue];
};

export default useLocalStorage;
