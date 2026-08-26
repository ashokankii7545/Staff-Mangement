import React, { forwardRef, memo } from 'react';
import PropTypes from 'prop-types';
import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import CardActionArea from '@mui/material/CardActionArea';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RemoveIcon from '@mui/icons-material/Remove';

/**
 * StatCard – Generic KPI / metric display card.
 *
 * Used identically across Admin dashboard (AdminStatCards) and Staff dashboard
 * (StaffDashboard KPI grid). Single source of truth for metric card styling.
 *
 * Props:
 *   label     – "Total Workforce", "This Month's Turnout"
 *   value     – "95%", "18", "8.2 hrs"
 *   meta      – Sub-caption text: "12 on-time • 2 late check-ins"
 *   badgeText – Top-right mini label: "100% Tracked", "26/30 Days"
 *   badgeBg   – Badge background color
 *   badgeColor – Badge text color
 *   progress  – Optional ReactNode (LinearProgress bar etc.)
 *   action    – Optional ReactNode (button, link etc.) rendered top-right
 *   loading   – Shows skeleton placeholder
 *   icon      – Optional MUI Icon rendered left of label
 *   trend     – Object with { value, direction: 'up'|'down'|'neutral' }
 *   onClick   – Makes card clickable
 *
 * Usage:
 *   <StatCard label="Active Turnout" value={present} meta="..." badgeText="24 on time" />
 */
const StatCard = forwardRef(({
  label,
  value,
  meta,
  badgeText,
  badgeBg = 'action.hover',
  badgeColor = 'text.secondary',
  icon: Icon,
  trend,
  progress,
  action,
  loading = false,
  onClick,
  sx,
  ...rest
}, ref) => {
  if (loading) {
    return (
      <Card ref={ref} sx={{ p: 2, height: '100%', ...sx }} {...rest}>
        <Stack spacing={1}>
          <Skeleton width="50%" height={16} />
          <Skeleton width="40%" height={32} />
          <Skeleton width="70%" height={14} />
        </Stack>
      </Card>
    );
  }

  const getTrendColor = (direction) => {
    if (direction === 'up') return 'success.main';
    if (direction === 'down') return 'error.main';
    return 'text.disabled';
  };

  const TrendIcon = trend?.direction === 'up' 
    ? TrendingUpIcon 
    : trend?.direction === 'down' ? TrendingDownIcon : RemoveIcon;

  const content = (
    <Box sx={{
      p: 2,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}>
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            {Icon && (
              <Box sx={{ p: 0.5, borderRadius: 1.5, bgcolor: 'action.hover', display: 'flex', color: 'primary.main' }}>
                <Icon fontSize="small" />
              </Box>
            )}
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              {label}
            </Typography>
          </Stack>
          {action || (
            badgeText && (
              <Box
                sx={{
                  bgcolor: badgeBg,
                  color: badgeColor,
                  px: 0.85,
                  py: 0.2,
                  borderRadius: 1,
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                }}
              >
                {badgeText}
              </Box>
            )
          )}
        </Stack>

        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ my: 0.5 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </Typography>
          {trend && (
            <Stack direction="row" alignItems="center" spacing={0.25} sx={{ color: getTrendColor(trend.direction) }}>
              <TrendIcon sx={{ fontSize: '0.875rem' }} />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>{trend.value}</Typography>
            </Stack>
          )}
        </Stack>

        {meta && (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {meta}
          </Typography>
        )}
      </Box>

      {progress}
    </Box>
  );

  return (
    <Card ref={ref} sx={{ height: '100%', ...sx }} {...rest}>
      {onClick ? (
        <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
          {content}
        </CardActionArea>
      ) : content}
    </Card>
  );
});

StatCard.displayName = 'StatCard';

StatCard.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.node.isRequired,
  meta: PropTypes.node,
  badgeText: PropTypes.string,
  badgeBg: PropTypes.string,
  badgeColor: PropTypes.string,
  icon: PropTypes.elementType,
  trend: PropTypes.shape({
    value: PropTypes.string.isRequired,
    direction: PropTypes.oneOf(['up', 'down', 'neutral']).isRequired,
  }),
  progress: PropTypes.node,
  action: PropTypes.node,
  loading: PropTypes.bool,
  onClick: PropTypes.func,
  sx: PropTypes.object,
};

export default memo(StatCard);
