import React, { useMemo } from 'react';
import { Box, TextField, MenuItem, Stack, InputAdornment, IconButton, Tooltip, Chip, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import { useDebounceFn } from '../../hooks';

/**
 * GenericFilterBar – THE filter toolbar for every list/grid in the app.
 *
 * Features:
 *  - Built-in 300ms debounced search (parent receives final values only)
 *  - Declarative select filters: [{ key, label, options, value, onChange }]
 *  - Active-filter chips with per-chip clear
 *  - Clear-all affordance appears only when something is active
 *  - Responsive: search goes full-width on mobile
 *
 * @param {string}  search          – Current search text (controlled)
 * @param {Function} onSearchChange – (debouncedText) => void  ← fires at most once per 300ms
 * @param {boolean} [immediateSearch=false] – Skip debounce (fires per keystroke)
 * @param {Array}   filters         – Select filters
 * @param {Array}   [chips]         – Extra removable chips [{ label, onRemove }]
 * @param {React.ReactNode} actions – Right-aligned action buttons
 * @param {Function} [onClearAll]
 */
export const GenericFilterBar = ({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  immediateSearch = false,
  filters = [],
  chips = [],
  actions,
  onClearAll,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // ahooks useDebounceFn – one debounced dispatcher, no re-render loops
  const { run: debouncedSearch, flush } = useDebounceFn(
    (text) => onSearchChange?.(text),
    { wait: immediateSearch ? 0 : 300 }
  );

  const handleSearch = (text) => {
    if (!text && !immediateSearch) flush(); // clear must apply instantly
    debouncedSearch(text);
  };

  const hasActiveFilters =
    !!search || filters.some((f) => f.value) || chips.length > 0;

  const selectChips = useMemo(
    () =>
      filters
        .filter((f) => f.value)
        .map((f) => ({
          key: `filter-${f.key}`,
          label: `${f.label}: ${f.options?.find((o) => o.value === f.value)?.label ?? f.value}`,
          onRemove: () => f.onChange(''),
        })),
    [filters]
  );

  return (
    <Box
      sx={{
        p: 2,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1.5,
        alignItems: 'center',
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {/* Debounced Search Input */}
      {onSearchChange && (
        <TextField
          size="small"
          type="search"
          placeholder={searchPlaceholder}
          defaultValue={search || ''}
          onChange={(e) => handleSearch(e.target.value)}
          sx={{ minWidth: { xs: '100%', sm: 260 }, flexGrow: { xs: 1, sm: 0 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />
      )}

      {/* Select Filters */}
      {filters.map((filter) => (
        <TextField
          key={filter.key}
          select
          size="small"
          label={filter.label}
          value={filter.value || ''}
          onChange={(e) => filter.onChange(e.target.value)}
          sx={{ minWidth: 150 }}
        >
          {(filter.options || []).map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      ))}

      {/* Clear All */}
      {onClearAll && hasActiveFilters && (
        <Tooltip title="Clear all filters">
          <IconButton
            onClick={() => {
              handleSearch('');
              onClearAll();
            }}
            size="small"
            aria-label="Clear all filters"
          >
            <FilterListOffIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* Spacer pushes actions right */}
      <Box sx={{ flexGrow: 1 }} />

      {/* Extra Actions */}
      {actions && (
        <Stack direction="row" spacing={1}>
          {actions}
        </Stack>
      )}

      {/* Active filter chips row */}
      {(selectChips.length > 0 || chips.length > 0) && (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ width: '100%', mt: -0.5 }}>
          {[...selectChips, ...chips].map((chip) => (
            <Chip
              key={chip.key || chip.label}
              label={chip.label}
              size="small"
              onDelete={chip.onRemove}
              deleteIcon={<ClearIcon fontSize="small" />}
              sx={{ borderRadius: 1.5, fontWeight: 500 }}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default GenericFilterBar;
