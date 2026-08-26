import React, { forwardRef, memo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { useTheme, alpha } from '@mui/material/styles';

/**
 * StatusBadge – Unified status pill used across the entire app.
 *
 * Automatically resolves background, text color, and label from a status key.
 * Also supports fully custom label/bg/color overrides.
 *
 * Usage:
 *   <StatusBadge status="PRESENT" />
 *   <StatusBadge status="LATE" suffix="+18m" />
 *   <StatusBadge label="Cover Duty" bg="#FEF3C7" color="#B45309" />
 */

const getStatusConfig = (theme) => ({
  // Attendance
  PRESENT:   { label: 'On-time',   bg: alpha(theme.palette.success.main, 0.08), color: 'success.dark', main: 'success.main' },
  LATE:      { label: 'Late',      bg: alpha(theme.palette.warning.main, 0.08), color: 'warning.dark', main: 'warning.main' },
  HALF_DAY:  { label: 'Half Day',  bg: alpha(theme.palette.warning.main, 0.08), color: 'warning.dark', main: 'warning.main' },
  ABSENT:    { label: 'Absent',    bg: alpha(theme.palette.error.main, 0.08), color: 'error.dark', main: 'error.main' },
  HOLIDAY:   { label: 'Holiday',   bg: alpha(theme.palette.info.main, 0.08), color: 'info.dark', main: 'info.main' },
  EXEMPT:    { label: 'Exempt',    bg: 'action.hover', color: 'text.secondary', main: 'text.secondary' },

  // Approval workflow
  PENDING:   { label: 'Pending',   bg: alpha(theme.palette.warning.main, 0.08), color: 'warning.dark', main: 'warning.main' },
  APPROVED:  { label: 'Approved',  bg: alpha(theme.palette.success.main, 0.08), color: 'success.dark', main: 'success.main' },
  REJECTED:  { label: 'Rejected',  bg: alpha(theme.palette.error.main, 0.08), color: 'error.main', main: 'error.main' },
  CANCELLED: { label: 'Cancelled', bg: 'action.hover', color: 'text.secondary', main: 'text.secondary' },
  VERIFIED:  { label: 'Verified',  bg: alpha(theme.palette.success.main, 0.08), color: 'success.dark', main: 'success.main' },

  // Shift
  ON_DUTY:   { label: 'On Duty',   bg: alpha(theme.palette.success.main, 0.08), color: 'success.dark', main: 'success.main' },
  OFF_DUTY:  { label: 'Off Duty',  bg: 'action.hover', color: 'text.secondary', main: 'text.secondary' },
  COMPLETED: { label: 'Completed', bg: 'action.selected', color: 'primary.main', main: 'primary.main' },
  ACTIVE:    { label: 'Active',    bg: 'action.selected', color: 'primary.main', main: 'primary.main' },

  // General
  SUCCESS:   { label: 'Success',   bg: alpha(theme.palette.success.main, 0.08), color: 'success.dark', main: 'success.main' },
  WARNING:   { label: 'Warning',   bg: alpha(theme.palette.warning.main, 0.08), color: 'warning.dark', main: 'warning.main' },
  ERROR:     { label: 'Error',     bg: alpha(theme.palette.error.main, 0.08), color: 'error.main', main: 'error.main' },
  INFO:      { label: 'Info',      bg: 'action.selected', color: 'primary.main', main: 'primary.main' },
  DEFAULT:   { label: '—',         bg: 'action.hover', color: 'text.secondary', main: 'text.secondary' },
});

const StatusBadge = forwardRef(({
  status,
  label: customLabel,
  bg: customBg,
  color: customColor,
  suffix,
  size = 'default',
  variant = 'filled',
  sx,
  ...rest
}, ref) => {
  const theme = useTheme();
  const STATUS_MAP = getStatusConfig(theme);
  
  const config = STATUS_MAP[status] || STATUS_MAP.DEFAULT;
  const displayLabel = customLabel || config.label;
  const mainColor = customColor || config.main;
  
  let bgColor = customBg || config.bg;
  let textColor = customColor || config.color;

  let variantStyles = {};

  if (variant === 'outlined') {
    bgColor = 'transparent';
    textColor = mainColor;
    variantStyles = { border: `1px solid`, borderColor: mainColor };
  } else if (variant === 'dot') {
    bgColor = 'transparent';
    textColor = 'text.primary';
    variantStyles = { display: 'flex', alignItems: 'center', gap: 0.75, px: 0, py: 0 };
  }

  const sizeStyles = size === 'small'
    ? { fontSize: '0.625rem', px: variant === 'dot' ? 0 : 0.6, py: variant === 'dot' ? 0 : 0.1 }
    : { fontSize: '0.6875rem', px: variant === 'dot' ? 0 : 0.85, py: variant === 'dot' ? 0 : 0.2 };

  return (
    <Box
      ref={ref}
      component="span"
      sx={{
        display: 'inline-flex',
        bgcolor: bgColor,
        color: textColor,
        borderRadius: 1,
        fontWeight: 600,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        ...sizeStyles,
        ...variantStyles,
        ...sx,
      }}
      {...rest}
    >
      {variant === 'dot' && (
        <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: mainColor }} />
      )}
      {displayLabel}{suffix ? ` ${suffix}` : ''}
    </Box>
  );
});

StatusBadge.displayName = 'StatusBadge';

StatusBadge.propTypes = {
  status: PropTypes.string,
  label: PropTypes.node,
  bg: PropTypes.string,
  color: PropTypes.string,
  suffix: PropTypes.node,
  size: PropTypes.oneOf(['small', 'default']),
  variant: PropTypes.oneOf(['filled', 'outlined', 'dot']),
  sx: PropTypes.object,
};

export default memo(StatusBadge);
