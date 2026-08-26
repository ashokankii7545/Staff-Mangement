import React from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { alpha, useTheme } from '@mui/material/styles';

/**
 * EmptyState – Enterprise-grade empty/error/search placeholder.
 *
 * Supports multiple semantic variants with automatic icon and message defaults,
 * custom illustrations, action slots, and compact mode for inline use.
 *
 * Variants:
 *   'empty'       – Default. No data exists yet.
 *   'search'      – Search returned no results.
 *   'error'       – Something went wrong loading data.
 *   'maintenance' – Feature is under maintenance.
 *
 * Usage:
 *   // Basic
 *   <EmptyState />
 *
 *   // Search variant with action
 *   <EmptyState
 *     variant="search"
 *     action={<AppButton onClick={clearFilters}>Clear Filters</AppButton>}
 *   />
 *
 *   // Error variant
 *   <EmptyState variant="error" description="Failed to load attendance records." />
 *
 *   // Custom illustration
 *   <EmptyState
 *     illustration={<img src="/empty-inbox.svg" alt="" width={120} />}
 *     title="No messages"
 *   />
 *
 *   // Compact mode (for inline use inside cards/tables)
 *   <EmptyState compact title="No rows" />
 */

const VARIANT_DEFAULTS = {
  empty: {
    icon: InboxOutlinedIcon,
    title: 'No records found',
    description: 'There is currently no data to display.',
    iconColor: 'text.disabled',
  },
  search: {
    icon: SearchOffIcon,
    title: 'No results found',
    description: 'Try adjusting your search or filter criteria.',
    iconColor: 'warning.main',
  },
  error: {
    icon: ErrorOutlineIcon,
    title: 'Something went wrong',
    description: 'We could not load the data. Please try again.',
    iconColor: 'error.main',
  },
  maintenance: {
    icon: BuildCircleIcon,
    title: 'Under maintenance',
    description: 'This feature is temporarily unavailable. Please check back later.',
    iconColor: 'info.main',
  },
  offline: {
    icon: WifiOffIcon,
    title: 'You are offline',
    description: 'Data will load automatically once your connection is restored.',
    iconColor: 'text.disabled',
  },
  permission: {
    icon: LockOutlinedIcon,
    title: 'Access restricted',
    description: 'You do not have permission to view this content.',
    iconColor: 'warning.main',
  },
};

const EmptyState = React.memo(({
  variant = 'empty',
  icon: IconOverride,
  title: titleOverride,
  description: descOverride,
  illustration,
  action,
  compact = false,
  sx,
}) => {
  const theme = useTheme();
  const defaults = VARIANT_DEFAULTS[variant] || VARIANT_DEFAULTS.empty;

  const Icon = IconOverride || defaults.icon;
  const title = titleOverride ?? defaults.title;
  const description = descOverride ?? defaults.description;

  const iconSize = compact ? 40 : 52;
  const iconFontSize = compact ? 22 : 28;

  return (
    <Box
      sx={{
        py: compact ? 3 : 5,
        px: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        ...sx,
      }}
    >
      {/* Illustration or Icon */}
      {illustration ? (
        <Box sx={{ mb: 2 }}>{illustration}</Box>
      ) : (
        <Box
          sx={{
            width: iconSize,
            height: iconSize,
            borderRadius: '50%',
            bgcolor: alpha(theme.palette.text.disabled, 0.08),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1.5,
            color: defaults.iconColor,
          }}
        >
          <Icon sx={{ fontSize: iconFontSize }} />
        </Box>
      )}

      {/* Title */}
      <Typography
        variant={compact ? 'body2' : 'subtitle1'}
        fontWeight={600}
        color="text.primary"
      >
        {title}
      </Typography>

      {/* Description */}
      {description && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            maxWidth: 360,
            mt: 0.5,
            mb: action ? 2 : 0,
            lineHeight: 1.6,
          }}
        >
          {description}
        </Typography>
      )}

      {/* Action slot */}
      {action && <Box sx={{ mt: 1.5 }}>{action}</Box>}
    </Box>
  );
});

EmptyState.displayName = 'EmptyState';

EmptyState.propTypes = {
  variant: PropTypes.oneOf(['empty', 'search', 'error', 'maintenance', 'offline', 'permission']),
  icon: PropTypes.elementType,
  title: PropTypes.node,
  description: PropTypes.node,
  illustration: PropTypes.node,
  action: PropTypes.node,
  compact: PropTypes.bool,
  sx: PropTypes.object,
};

export default EmptyState;
