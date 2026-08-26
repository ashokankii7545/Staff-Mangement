import { alpha } from '@mui/material/styles';
import { COLORS } from '../tokens/colors';

export const dataDisplayOverrides = (mode, shadows) => {
  // Interactive blue follows the mode (Carbon rule for dark themes)
  const BRAND = mode === 'light' ? COLORS.brandBlue60 : COLORS.brandBlue40;

  return {
  MuiTable: {
    styleOverrides: {
      root: { borderCollapse: 'separate', borderSpacing: '0' },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderBottom: `1px solid ${mode === 'light' ? COLORS.borderLight : COLORS.borderDark}`,
        padding: '12px 16px',
        fontSize: '0.8125rem',
      },
      head: {
        fontWeight: 600,
        color: mode === 'light' ? COLORS.textSecondaryLight : COLORS.textSecondaryDark,
        // Deeper tint than paper so the header row is actually distinguishable
        // in LIGHT mode (dark mode already contrasted well against paperDark)
        backgroundColor: mode === 'light' ? COLORS.tableHeadLight : COLORS.tableHeadDark,
        borderBottom: `1px solid ${mode === 'light' ? COLORS.tableHeadBorderLight : COLORS.borderDark}`,
        textTransform: 'uppercase',
        fontSize: '0.6875rem',
        letterSpacing: '0.04em',
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: { fontWeight: 500, borderRadius: 6 },
    },
  },
  MuiMenu: {
    styleOverrides: {
      paper: {
        borderRadius: 8,
        border: `1px solid ${mode === 'light' ? COLORS.borderLight : COLORS.borderDark}`,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  MuiList: {
    styleOverrides: {
      root: { padding: 4 },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        '&:hover': { backgroundColor: alpha(BRAND, 0.05) },
      },
    },
  },
  MuiTabs: {
    styleOverrides: {
      root: { minHeight: 40 },
      indicator: { height: 2, borderRadius: 2 },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontWeight: 500,
        minHeight: 40,
        '&.Mui-selected': { color: BRAND },
      },
    },
  },
  };
};

