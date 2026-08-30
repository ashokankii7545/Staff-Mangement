import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Checkbox,
  IconButton,
  Tooltip,
  Typography,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  ListItemText,
  Button,
  Skeleton,
  TablePagination,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SearchIcon from '@mui/icons-material/Search';
import EmptyState from '../EmptyState';
import { useDebounce } from '../../hooks';

const exportToCSV = (columns, rows, filename = 'data.csv') => {
  const headers = columns.map((col) => col.label);
  const csvRows = rows.map((row) =>
    columns.map((col) => {
      let value;
      if (col.valueGetter) value = col.valueGetter(row);
      else if (col.exportValue) value = col.exportValue(row);
      else if (col.render) value = '';
      else value = row[col.id];
      if (value == null) value = '';
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );
  const csvContent = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

/**
 * GenericDataGrid – THE table engine for the whole app.
 *
 * One component, both worlds:
 *  - Client-side: pass `rows` + `columns` → search/sort/paginate handled internally
 *    (search is debounced 300ms for buttery typing on large datasets)
 *  - Server-side: additionally pass `totalCount` + `onPageChange` → pagination
 *    and sorting are delegated to the parent
 *
 * Extras: column visibility menu, CSV export (`exportValue` per column),
 * row selection, dense widget mode (`size="small"`, `hidePagination`),
 * error state with retry.
 */
export const GenericDataGrid = ({
  columns,
  rows,
  loading = false,
  error = null,
  page = 0,
  onPageChange,
  rowsPerPage = 10,
  onRowsPerPageChange,
  totalCount,
  sortBy,
  sortDirection = 'asc',
  onSortChange,
  onSearch,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  title,
  showToolbar = true,
  searchPlaceholder = 'Search...',
  exportEnabled = false,
  filename = 'export.csv',
  toolbarActions,
  /** MUI density – use 'small' inside dashboard cards/widgets */
  size = 'medium',
  /** Hide the pagination footer entirely (widgets showing "top N" rows) */
  hidePagination = false,
  /** Called when the user taps Retry on the error state (falls back to reload) */
  onRetry,
    /** Optional: called with (row) when a body row is clicked. Makes rows clickable. */
  onRowClick,
  /** Optional key to persist grid state (page/search/columns/sort) across visits. Falls back to `title`. */
  stateKey,
}) => {
        // ── Persist grid view-state (page/search/columns/density/sort) so it survives
  //    unmount/remount (route nav, Apollo reload, hard refresh). The parent passes
  //    a fresh `columns` array EVERY render — the old "reset to all columns" effect
  //    wiped user toggles + state on every Apollo update. ──────────────────────
  const gridStateKey = stateKey || title || 'datagrid';
  const gridStoragePrefix = `gdg:${gridStateKey}:`;
  const readStorage = useCallback((k, fallback) => {
    try {
      const v = localStorage.getItem(`${gridStoragePrefix}${k}`);
      return v !== null ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  }, [gridStoragePrefix]);
  const writeStorage = useCallback((k, v) => {
    try { localStorage.setItem(`${gridStoragePrefix}${k}`, JSON.stringify(v)); } catch { /* quota/private */ }
  }, [gridStoragePrefix]);

  const [internalPage, setInternalPage] = useState(() => Number(readStorage('page', 0)) || 0);
  const [internalRowsPerPage, setInternalRowsPerPage] = useState(() => Number(readStorage('rpp', rowsPerPage)) || rowsPerPage);
  const [internalSortBy, setInternalSortBy] = useState(() => readStorage('sortBy', sortBy));
  const [internalSortDirection, setInternalSortDirection] = useState(() => readStorage('sortDir', sortDirection));
  const [searchText, setSearchText] = useState(() => readStorage('search', '') || '');
  const debouncedSearchText = useDebounce(searchText, 300);
  const [filterAnchor, setFilterAnchor] = useState(null);

  // Column visibility — restore from storage, else show all.
  const [visibleColumns, setVisibleColumns] = useState(() =>
    readStorage('cols', null) || columns.map((col) => col.id)
  );

  // Merge dynamically: when the parent passes a NEW columns array every render,
  // only ADD brand-new ids and DROP removed ones — never wipe a toggled-off column.
  useEffect(() => {
    setVisibleColumns((prev) => {
      const colIds = new Set(columns.map((col) => col.id));
      const merged = prev.filter((id) => colIds.has(id));
      colIds.forEach((id) => { if (!merged.includes(id)) merged.push(id); });
      return merged;
    });
  }, [columns]);

  // Call onSearch ONLY when the debounced search string actually changes.
  // Depending on `onSearch` (an inline arrow recreated every parent render)
  // made this fire on every render – and since the parent's onSearch resets
  // the page to 0, server-side pagination snapped back to page 1 on every
  // refetch. A ref-tracked previous value + skipping the initial mount fixes
  // it: search still works, but paging no longer triggers a phantom "search".
  const prevSearchRef = useRef(debouncedSearchText);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  useEffect(() => {
    if (prevSearchRef.current === debouncedSearchText) return;
    prevSearchRef.current = debouncedSearchText;
    onSearchRef.current?.(debouncedSearchText);
  }, [debouncedSearchText]);

  // Persist view-state to localStorage so it survives remount/refresh/nav.
  useEffect(() => {
    writeStorage('page', internalPage);
    writeStorage('rpp', internalRowsPerPage);
    writeStorage('search', searchText);
    writeStorage('sortBy', internalSortBy);
    writeStorage('sortDir', internalSortDirection);
    writeStorage('cols', visibleColumns);
  }, [internalPage, internalRowsPerPage, searchText, internalSortBy, internalSortDirection, visibleColumns, writeStorage]);

  // Server-driven grid mode keyed off onPageChange only - STABLE prop. totalCount
  // is 0 mid-fetch; deriving mode from it flips the grid to client-side mode and
  // "loses" pagination at every keystroke.
  const isServerSide = typeof onPageChange === 'function';
  const currentPage = isServerSide ? page : internalPage;
  const currentRowsPerPage = isServerSide ? rowsPerPage : internalRowsPerPage;

  const filteredRows = useMemo(() => {
    if (isServerSide) return rows;
    let result = [...rows];
    if (debouncedSearchText) {
      const q = debouncedSearchText.toLowerCase();
      result = result.filter((row) =>
        columns.some((col) => {
          let val = col.valueGetter ? col.valueGetter(row) : row[col.id];
          if (val && typeof val === 'object') {
            try {
              val = JSON.stringify(val);
                                    } catch {
              val = '';
            }
          }
          return String(val ?? '').toLowerCase().includes(q);
        })
      );
    }
    if (internalSortBy) {
      result.sort((a, b) => {
        let aVal = a[internalSortBy];
        let bVal = b[internalSortBy];
        if (aVal && typeof aVal === 'object') aVal = '';
        if (bVal && typeof bVal === 'object') bVal = '';
        if (aVal < bVal) return internalSortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return internalSortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
        return result;
  }, [rows, debouncedSearchText, internalSortBy, internalSortDirection, isServerSide, columns]);

  const paginatedRows = useMemo(() => {
    if (isServerSide || hidePagination) return filteredRows;
    const start = currentPage * currentRowsPerPage;
    return filteredRows.slice(start, start + currentRowsPerPage);
  }, [filteredRows, currentPage, currentRowsPerPage, isServerSide, hidePagination]);

        const effectiveTotalCount = isServerSide ? totalCount : (hidePagination ? paginatedRows.length : filteredRows.length);

  // Keep the current page valid when the (client-side) row-set shrinks below it,
  // e.g. after a search filter or data load with fewer results.
  // Skip while the row-set is empty (loading / no-match / server fetch) so the
  // page isn't clamped to 0 and then stuck there once data arrives.
  useEffect(() => {
    if (isServerSide || hidePagination || filteredRows.length === 0) return;
    const lastPageIndex = Math.max(0, Math.ceil(filteredRows.length / currentRowsPerPage) - 1);
    setInternalPage((p) => (p > lastPageIndex ? lastPageIndex : p));
  }, [filteredRows.length, currentRowsPerPage, isServerSide, hidePagination]);

  const handleSort = (columnId) => {
    const isAsc = internalSortBy === columnId && internalSortDirection === 'asc';
    const newDirection = isAsc ? 'desc' : 'asc';
    if (isServerSide && onSortChange) {
      onSortChange(columnId, newDirection);
    } else {
      setInternalSortBy(columnId);
      setInternalSortDirection(newDirection);
    }
  };

  const handleChangePage = (event, newPage) => {
    if (isServerSide && onPageChange) onPageChange(newPage);
    else setInternalPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    if (isServerSide && onRowsPerPageChange) onRowsPerPageChange(newRowsPerPage);
    else setInternalRowsPerPage(newRowsPerPage);
    setInternalPage(0);
    if (isServerSide && onPageChange) onPageChange(0); // MUI: new page size -> back to page 1
  };

  const _handleSelectAll = (checked) => {
    onSelectionChange?.(checked ? paginatedRows.map((row) => row.id) : []);
  };

  const handleSelectOne = (id, checked) => {
    onSelectionChange?.(
      checked ? [...selectedIds, id] : selectedIds.filter((sel) => sel !== id)
    );
  };

  const handleExport = () => {
    exportToCSV(columns, isServerSide ? paginatedRows : filteredRows, filename);
  };

  const openFilterMenu = (event) => setFilterAnchor(event.currentTarget);
  const closeFilterMenu = () => setFilterAnchor(null);
  const toggleColumnVisibility = (colId) => {
    setVisibleColumns((prev) =>
      prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]
    );
  };

  const displayColumns = columns.filter((col) => visibleColumns.includes(col.id));
  const totalColumnCount = displayColumns.length + (selectable ? 1 : 0);

  /**
   * Shared header-cell renderer – reused by BOTH the data view and the
   * empty state so column headers stay visible even when there is no data.
   */
  const renderHeadCells = () => (
    <TableRow>
      {selectable && <TableCell padding="checkbox" />}
      {displayColumns.map((col) => (
        <TableCell
          key={col.id}
          align={col.align || 'left'}
          style={{ width: col.width }}
          sortDirection={internalSortBy === col.id ? internalSortDirection : false}
        >
          {col.sortable !== false && !col.render?.skipSort ? (
            <TableSortLabel
              active={internalSortBy === col.id}
              direction={internalSortBy === col.id ? internalSortDirection : 'asc'}
              onClick={() => handleSort(col.id)}
            >
              {col.label}
            </TableSortLabel>
          ) : (
            col.label
          )}
        </TableCell>
      ))}
    </TableRow>
  );

  const toolbar = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2,
        flexWrap: 'wrap',
        // Separate the grid header strip from the data rows – it used to melt
        // into the white card in light mode
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: (theme) => alpha(theme.palette.text.primary, 0.02),
      }}
    >
      <Typography variant="h6" sx={{ flexGrow: 1 }}>
        {title}
      </Typography>
      <TextField
        size="small"
        placeholder={searchPlaceholder}
        value={searchText}
        onChange={(e) => {
          setSearchText(e.target.value);
          if (!isServerSide) setInternalPage(0);
          if (isServerSide && onPageChange) onPageChange(0);
        }}
        sx={{ width: { xs: '100%', sm: 250 } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
      />
      <Tooltip title="Column visibility">
        <IconButton onClick={openFilterMenu} size="small" aria-label="Toggle column visibility">
          <ViewColumnIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={filterAnchor} open={Boolean(filterAnchor)} onClose={closeFilterMenu}>
        {columns.map((col) => (
          <MenuItem key={col.id} onClick={() => toggleColumnVisibility(col.id)}>
            <Checkbox checked={visibleColumns.includes(col.id)} />
            <ListItemText primary={col.label} />
          </MenuItem>
        ))}
      </Menu>
      {exportEnabled && (
        <Tooltip title="Export CSV">
          <IconButton onClick={handleExport} size="small" aria-label="Export as CSV">
            <FileDownloadIcon />
          </IconButton>
        </Tooltip>
      )}
      {toolbarActions}
    </Box>
  );

  if (loading) {
    return (
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        {showToolbar && toolbar}
        <Box sx={{ p: 2 }}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} height={40} sx={{ my: 1 }} />
          ))}
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        {showToolbar && toolbar}
        <EmptyState
          variant="error"
          description={typeof error === 'string' ? error : error?.message}
          action={
            <Button variant="outlined" onClick={() => (onRetry ? onRetry() : window.location.reload())}>
              Retry
            </Button>
          }
        />
      </Paper>
    );
  }

  if (paginatedRows.length === 0) {
    return (
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        {showToolbar && toolbar}
        {/* Keep the grid skeleton (header + columns) visible on empty – only the body says "No data" */}
        <TableContainer>
          <Table stickyHeader size={size} aria-label={title || 'data table'}>
            <TableHead>{renderHeadCells()}</TableHead>
            <TableBody>
              <TableRow>
                <TableCell colSpan={totalColumnCount} align="center" sx={{ py: 6 }}>
                  <EmptyState variant={searchText ? 'search' : 'empty'} compact />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        {!hidePagination && (
          <TablePagination
            sx={{ borderTop: '1px solid', borderColor: 'divider' }}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            component="div"
            count={0}
            rowsPerPage={currentRowsPerPage}
            page={0}
            onPageChange={() => {}}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        )}
      </Paper>
    );
  }

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      {showToolbar && toolbar}
      <TableContainer >
        <Table stickyHeader size={size} aria-label={title || 'data table'}>
          <TableHead>{renderHeadCells()}</TableHead>
          <TableBody>
            {paginatedRows.map((row) => (
              <TableRow
                key={row.id}
                hover
                selected={selectedIds.includes(row.id)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                sx={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {selectable && (
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(row.id)}
                      onChange={(e) => handleSelectOne(row.id, e.target.checked)}
                    />
                  </TableCell>
                )}
                {displayColumns.map((col) => (
                  <TableCell
                    key={col.id}
                    align={col.align || 'left'}
                    // Interactive cells (buttons, switches) opt out of the row click.
                    onClick={onRowClick && col.stopRowClick ? (e) => e.stopPropagation() : undefined}
                  >
                    {col.render ? col.render(row) : row[col.id]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {!hidePagination && (
        <TablePagination
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
          rowsPerPageOptions={[5, 10, 25, 50, 100]}
          component="div"
          count={effectiveTotalCount}
          rowsPerPage={currentRowsPerPage}
          page={currentPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      )}
    </Paper>
  );
};

export default GenericDataGrid;
