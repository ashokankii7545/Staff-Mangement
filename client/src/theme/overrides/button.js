import { alpha } from '@mui/material/styles';
import { COLORS } from '../tokens/colors';

// Mode-aware so the interactive blue lifts on dark surfaces (Carbon rule)
export const buttonOverrides = (mode) => {
  const BRAND = mode === 'light' ? COLORS.brandBlue60 : COLORS.brandBlue40;

  return {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: '6px 14px',
          fontWeight: 500,
          transition: 'all 0.15s ease',
          '&:focus-visible': {
            outline: `2px solid ${alpha(BRAND, 0.5)}`,
            outlineOffset: '2px',
          },
        },
        // Fill & hover come from palette.primary (mode-aware) - never hardcode
        outlinedPrimary: {
          borderColor: alpha(BRAND, 0.4),
          '&:hover': {
            borderColor: BRAND,
            backgroundColor: alpha(BRAND, 0.04),
          },
        },
        textPrimary: {
          '&:hover': { backgroundColor: alpha(BRAND, 0.06) },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: 'all 0.15s ease',
          '&:hover': { backgroundColor: alpha(BRAND, 0.06) },
        },
      },
    },
  };
};