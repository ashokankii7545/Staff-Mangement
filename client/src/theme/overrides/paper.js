import { COLORS } from '../tokens/colors';

export const paperOverrides = (mode) => ({
  MuiPaper: {
    defaultProps: { elevation: 0 },
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        border: `1px solid ${mode === 'light' ? COLORS.borderLight : COLORS.borderDark}`,
        boxShadow: mode === 'light'
          ? '0 1px 3px 0 rgba(0, 0, 0, 0.04)'
          : 'none',
      },
      rounded: { borderRadius: 8 },
    },
  },
  MuiCard: {
    defaultProps: { elevation: 0 },
    styleOverrides: {
      root: {
        borderRadius: 8,
        border: `1px solid ${mode === 'light' ? COLORS.borderLight : COLORS.borderDark}`,
        boxShadow: mode === 'light'
          ? '0 1px 3px 0 rgba(0, 0, 0, 0.04)'
          : 'none',
        // No hover animation — cards are static containers (Stripe/Google pattern)
      },
    },
  },
});

