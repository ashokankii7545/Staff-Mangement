import React, { useState, useMemo, useEffect } from 'react';
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
}) => {
  const [internalPage, setInternalPage] = useState(0);
  const [internalRowsPerPage, setInternalRowsPerPage] = useState(rowsPerPage);
  const [internalSortBy, setInternalSortBy] = useState(sortBy);
  const [internalSortDirection, setInternalSortDirection] = useState(sortDirection);
  const [searchText, setSearchText] = useState('');
  const debouncedSearchText = useDebounce(searchText, 300);
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState(columns.map((col) => col.id));

  // Keep column-visibility state in sync when columns change dynamically
  useEffect(() => {
    setVisibleColumns(columns.map((col) => col.id));
  }, [columns]);

  const isServerSide = !!totalCount && !!onPageChange;
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
            } catch (e) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, debouncedSearchText, internalSortBy, internalSortDirection, isServerSide, columns]);

  const paginatedRows = useMemo(() => {
    if (isServerSide || hidePagination) return filteredRows;
    const start = currentPage * currentRowsPerPage;
    return filteredRows.slice(start, start + currentRowsPerPage);
  }, [filteredRows, currentPage, currentRowsPerPage, isServerSide, hidePagination]);

  const effectiveTotalCount = isServerSide ? totalCount : (hidePagination ? paginatedRows.length : filteredRows.length);

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
  };

  const handleSelectAll = (checked) => {
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
          setInternalPage(0);
        }}
        disabled={isServerSide}
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
        <TableContainer sx={{ maxHeight: 'calc(100vh - 250px)' }}>
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
      <TableContainer sx={{ maxHeight: 'calc(100vh - 250px)' }}>
        <Table stickyHeader size={size} aria-label={title || 'data table'}>
          <TableHead>{renderHeadCells()}</TableHead>
          <TableBody>
            {paginatedRows.map((row) => (
              <TableRow key={row.id} hover selected={selectedIds.includes(row.id)}>
                {selectable && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.includes(row.id)}
                      onChange={(e) => handleSelectOne(row.id, e.target.checked)}
                    />
                  </TableCell>
                )}
                {displayColumns.map((col) => (
                  <TableCell key={col.id} align={col.align || 'left'}>
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
