import { COLORS } from '../tokens/colors';

export const feedbackOverrides = (mode, shadows) => ({
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 12,
        border: `1px solid ${mode === 'light' ? COLORS.borderLight : COLORS.borderDark}`,
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  MuiSnackbarContent: {
    styleOverrides: {
      root: { borderRadius: 8 },
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        backgroundColor: mode === 'light' ? COLORS.textPrimaryLight : COLORS.textPrimaryDark,
        color: mode === 'light' ? COLORS.paperLight : COLORS.textPrimaryLight,
        fontSize: '0.75rem',
        padding: '6px 10px',
        borderRadius: 6,
      },
    },
  },
  MuiLinearProgress: {
    styleOverrides: {
      root: { borderRadius: 4, height: 4 },
    },
  },
});

