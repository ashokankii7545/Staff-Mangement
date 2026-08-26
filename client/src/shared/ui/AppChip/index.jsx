import Chip from '@mui/material/Chip';
import PropTypes from 'prop-types';

/**
 * AppChip – Standardized informational pill/tag (the `Chip` of this design system,
 * named after AppButton). Use for metadata tags: radius values, countdowns,
 * GPS state, roles, etc. For workflow statuses use `StatusBadge` instead.
 *
 * Theme-tokenized by default – never pass raw hex colors.
 *
 * Usage:
 *   <AppChip label={`Radius: ${r}m`} />
 *   <AppChip tone="warning" label="In 3 days" icon={<TimerIcon />} />
 *   <AppChip label="Draft" onDelete={clear} />
 */
const TONES = {
  default: { bg: 'action.selected', fg: 'text.secondary', outlinedFg: 'text.secondary' },
  primary: { bg: 'action.selected', fg: 'primary.main', outlinedFg: 'primary.main' },
  success: { bg: 'success.light', fg: 'success.dark', outlinedFg: 'success.main' },
  warning: { bg: 'warning.light', fg: 'warning.dark', outlinedFg: 'warning.main' },
  error: { bg: 'error.light', fg: 'error.dark', outlinedFg: 'error.main' },
  info: { bg: 'info.light', fg: 'info.dark', outlinedFg: 'info.main' },
};

const AppChip = ({ tone = 'default', variant = 'filled', size = 'small', sx, ...rest }) => {
  const t = TONES[tone] || TONES.default;

  const toneStyles =
    variant === 'outlined'
      ? { color: t.fg, borderColor: 'currentColor' }
      : { bgcolor: t.bg, color: t.fg };

  return (
    <Chip
      size={size}
      variant={variant}
      sx={{
        fontWeight: 600,
        fontSize: size === 'small' ? '0.6875rem' : '0.75rem',
        height: size === 'small' ? 20 : 24,
        borderRadius: 1,
        ...toneStyles,
        ...sx,
      }}
      {...rest}
    />
  );
};

AppChip.propTypes = {
  /** Semantic palette tone – maps to theme tokens, dark-mode safe */
  tone: PropTypes.oneOf(['default', 'primary', 'success', 'warning', 'error', 'info']),
  variant: PropTypes.oneOf(['filled', 'outlined']),
  size: PropTypes.oneOf(['small', 'medium']),
  sx: PropTypes.object,
};

export default AppChip;
