import { useState, useCallback, useEffect } from 'react';

/**
 * Persisted grid view-state (page / rows-per-page / search) in localStorage.
 *
 * Server-driven grids (totalCount + onPageChange) are backed by PARENT state
 * that resets on every remount → pagination/search bounce back to page 1.
 *   This hook reads that state back from localStorage on first render and
 * keeps it in sync, so "go to page 2 → navigate → come back" stays on page 2.
 *
 * @param {string} key  unique key, e.g. 'staff-roster' / 'medicine-catalogue'
 * @returns {{ page: number, setPage: fn, rowsPerPage: number, setRowsPerPage: fn, search: string, setSearch: fn }}
 */
export const usePersistentGridState = (key) => {
  const [page, setPage] = useState(() => {
    try {
      return Number(localStorage.getItem(`grid:${key}:page`)) || 0;
    } catch { return 0; }
  });
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    try {
      return Number(localStorage.getItem(`grid:${key}:rpp`)) || 10;
    } catch { return 10; }
  });
  const [search, setSearch] = useState(() => {
    try {
      return localStorage.getItem(`grid:${key}:search`) || '';
    } catch { return ''; }
  });

  const persist = useCallback((k, v) => {
    try { localStorage.setItem(`grid:${key}:${k}`, String(v)); } catch { /* quota */ }
  }, [key]);

  // Sync every change to localStorage (cheap, once per action)
  useEffect(() => { persist('page', page); }, [page, persist]);
  useEffect(() => { persist('rpp', rowsPerPage); }, [rowsPerPage, persist]);
  useEffect(() => { persist('search', search); }, [search, persist]);

  // When search changes, snap back to page 1 (matches MUI table semantics)
  const setSearchPersisted = useCallback((next) => {
    setSearch(typeof next === 'function' ? next(search) : next);
    setPage(0);
  }, [search]);

  return { page, setPage, rowsPerPage, setRowsPerPage, search, setSearch: setSearchPersisted };
};

export default usePersistentGridState;
