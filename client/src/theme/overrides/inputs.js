import { alpha } from '@mui/material/styles';
import { COLORS } from '../tokens/colors';

export const inputOverrides = (mode) => {
  const BRAND = mode === 'light' ? COLORS.brandBlue60 : COLORS.brandBlue40;

  return {
  MuiTextField: {
    defaultProps: { variant: 'outlined', size: 'small' },
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 8,
          transition: 'border-color 0.15s ease',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(BRAND, 0.5),
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: BRAND,
            borderWidth: '2px',
          },
        },
      },
    },
  },
  MuiAutocomplete: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': { borderRadius: 8 },
      },
      paper: { borderRadius: 8 },
    },
  },
  MuiSwitch: {
    styleOverrides: {
      root: { width: 42, height: 26, padding: 0 },
      switchBase: {
        padding: 1,
        '&.Mui-checked': {
          transform: 'translateX(16px)',
          color: '#fff',
          '& + .MuiSwitch-track': {
            backgroundColor: BRAND,
            opacity: 1,
          },
        },
      },
      thumb: { width: 24, height: 24 },
      track: {
        borderRadius: 13,
        backgroundColor: mode === 'light' ? COLORS.borderLight : COLORS.borderDark,
        opacity: 1,
      },
    },
  },
  };
};


