import { createTheme, responsiveFontSizes, alpha } from '@mui/material/styles';
import { COLORS } from './tokens/colors';
import { typography } from './tokens/typography';
import { spacing } from './tokens/spacing';
import { shadows } from './tokens/shadows';

import { buttonOverrides } from './overrides/button';
import { paperOverrides } from './overrides/paper';
import { inputOverrides } from './overrides/inputs';
import { feedbackOverrides } from './overrides/feedback';
import { dataDisplayOverrides } from './overrides/dataDisplay';

const getBaseTheme = (mode) => {
  // Interactive brand colour lifts on dark surfaces (the Carbon/M3 rule):
  // light mode wears deep blue-60, dark mode wears softer blue-40.
  const isLight = mode === 'light';
  const BRAND = isLight ? COLORS.brandBlue60 : COLORS.brandBlue40;

  return {
  palette: {
    mode,
    primary: {
      main: BRAND,
      light: COLORS.brandBlue30,
      dark: isLight ? COLORS.brandBlue80 : COLORS.brandBlue30,
      contrastText: isLight ? COLORS.onBrandFillLight : COLORS.onBrandFillDark,
    },
    secondary: {
      main: COLORS.secondary,
      light: COLORS.secondarySoft,
      dark: COLORS.borderDark,
      contrastText: COLORS.paperLight,
    },
    success: { main: COLORS.success, light: COLORS.successTint },
    warning: { main: COLORS.warning, light: COLORS.warningTint },
    error: { main: COLORS.error, light: COLORS.errorTint },
    info: { main: COLORS.info, light: COLORS.infoTint },
    background: {
      default: mode === 'light' ? COLORS.backgroundLight : COLORS.backgroundDark,
      paper: mode === 'light' ? COLORS.paperLight : COLORS.paperDark,
    },
    text: {
      primary: mode === 'light' ? COLORS.textPrimaryLight : COLORS.textPrimaryDark,
      secondary: mode === 'light' ? COLORS.textSecondaryLight : COLORS.textSecondaryDark,
    },
    divider: mode === 'light' ? COLORS.borderLight : COLORS.borderDark,
    action: {
      selected: alpha(BRAND, isLight ? 0.09 : 0.18),
      hover: alpha(BRAND, isLight ? 0.04 : 0.10),
    },
  },
  typography,
  shape: { borderRadius: 8 },
  spacing,
  shadows,
  transitions: {
    duration: {
      shortest: 150, shorter: 200, short: 250,
      standard: 300, complex: 375,
      enteringScreen: 225, leavingScreen: 195,
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
    },
  },
  zIndex: {
    mobileStepper: 1000, speedDial: 1050, appBar: 1100,
    drawer: 1200, modal: 1300, snackbar: 1400, tooltip: 1500,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'html, body, #root': {
          height: '100%',
          width: '100%',
          margin: 0,
          padding: 0,
          overflow: 'hidden',
        },
        body: {
          backgroundColor: mode === 'light' ? COLORS.backgroundLight : COLORS.backgroundDark,
          color: mode === 'light' ? COLORS.textPrimaryLight : COLORS.textPrimaryDark,
          transition: 'background-color 0.2s ease, color 0.2s ease',
        },
        'input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active': {
          WebkitBoxShadow: mode === 'light' 
            ? `0 0 0 1000px ${COLORS.paperLight} inset !important`
            : `0 0 0 1000px ${COLORS.paperDark} inset !important`,
          WebkitTextFillColor: mode === 'light' 
            ? `${COLORS.textPrimaryLight} !important`
            : `${COLORS.textPrimaryDark} !important`,
          transition: 'background-color 5000s ease-in-out 0s',
        },
        '*::-webkit-scrollbar': {
          width: '6px',
          height: '6px',
        },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: mode === 'light' ? COLORS.scrollThumbLight : COLORS.scrollThumbDark,
          borderRadius: '4px',
        },
        '*::-webkit-scrollbar-track': {
          backgroundColor: 'transparent',
        },
        '*': {
          scrollbarWidth: 'thin',
          scrollbarColor: mode === 'light'
            ? `${COLORS.scrollThumbLight} transparent`
            : `${COLORS.scrollThumbDark} transparent`,
        },
      },
    },
    ...buttonOverrides(mode),
    ...paperOverrides(mode),
    ...inputOverrides(mode),
    ...feedbackOverrides(mode, shadows),
    ...dataDisplayOverrides(mode, shadows),
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          // Frosted-glass header - soft translucent surface over the canvas
          backgroundColor: mode === 'light'
            ? COLORS.appBarBgLight
            : COLORS.appBarBgDark,
          borderBottom: `1px solid ${mode === 'light' ? COLORS.borderLight : COLORS.borderDark}`,
          boxShadow: 'none',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          // Base fallback – neutral chrome matching the mode-aware sidebar
          backgroundColor: mode === 'light' ? COLORS.sidebarBgLight : COLORS.sidebarBgDark,
          borderRight: `1px solid ${mode === 'light' ? COLORS.borderLight : COLORS.borderDark}`,
        },
      },
    },
  },
  };
};

export const getAppTheme = (mode) => {
  let theme = createTheme(getBaseTheme(mode));
  theme = responsiveFontSizes(theme);
  return theme;
};


