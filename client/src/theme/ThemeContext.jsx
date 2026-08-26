import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';
import { gql, useApolloClient } from '@apollo/client';
import {
  ThemeProvider as MuiThemeProvider,
} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import Tooltip from '@mui/material/Tooltip';
import { getAppTheme } from './index';

const SET_THEME_PREFERENCE = gql`
  mutation SetThemePreference($mode: String!) {
    setThemePreference(mode: $mode) {
      id
      themePreference
    }
  }
`;

const VALID_MODES = ['light', 'dark', 'system'];

const ThemeModeContext = createContext({
  mode: 'system',
  resolvedMode: 'light',
  setMode: () => {},
});

export const useThemeMode = () => useContext(ThemeModeContext);

// ── Backend persistence plumbing ────────────────────────────────────────────
// ThemeProvider sits ABOVE AuthProvider/Apollo in the tree, so it cannot call
// the API itself. Deeper components (with auth + apollo context) plug a
// persister in via registerThemePersister(); explicit user changes then hit
// the backend so the preference follows the user across devices & re-logins.
let themePersister = null;
export const registerThemePersister = (fn) => {
  themePersister = typeof fn === 'function' ? fn : null;
};

// Programmatic application (adopting the server-stored preference on login)
// WITHOUT triggering an API write-back loop.
let internalSetMode = null;
export const applyExternalThemeMode = (mode) => {
  if (internalSetMode && VALID_MODES.includes(mode)) internalSetMode(mode);
};

export const AppThemeProvider = ({ children }) => {
  const [mode, setModeState] = useState(() => {
    return localStorage.getItem('app-theme-mode') || 'system';
  });

  // Keep module-level reference in sync (no persistence side-effects)
  internalSetMode = setModeState;

  const [resolvedMode, setResolvedMode] = useState('light');

  /** User-initiated change → update UI AND persist to the backend */
  const setMode = (newMode) => {
    setModeState(newMode);
    try {
      themePersister?.(newMode);
    } catch (err) {
      console.error('Theme persistence failed:', err);
    }
  };

  useLayoutEffect(() => {
    const updateResolvedMode = () => {
      if (mode === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setResolvedMode(isDark ? 'dark' : 'light');
      } else {
        setResolvedMode(mode);
      }
    };

    updateResolvedMode();
    localStorage.setItem('app-theme-mode', mode);

    if (mode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e) => setResolvedMode(e.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [mode]);

  const theme = useMemo(() => getAppTheme(resolvedMode), [resolvedMode]);

  return (
    <ThemeModeContext.Provider value={{ mode, resolvedMode, setMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeModeContext.Provider>
  );
};

/**
 * ThemeSync – lives INSIDE AuthProvider/Apollo so it can read the logged-in
 * user and call the API:
 *   1. On login / user change → adopt the server-stored themePreference
 *      (fixes "relogin ya browser change pe default aa jata hai").
 *   2. Registers the persister → every explicit toggle hits the backend too.
 */
export const ThemeSync = ({ user }) => {
  const client = useApolloClient();

  // Adopt the stored preference when the user logs in or switches account
  useEffect(() => {
    const pref = user?.themePreference;
    if (pref && VALID_MODES.includes(pref)) {
      applyExternalThemeMode(pref);
    }
  }, [user?.id]);

  // Explicit changes by THIS user are written back to the server
  useEffect(() => {
    registerThemePersister((mode) => {
      if (!user) return; // guests stay localStorage-only
      client
        .mutate({ mutation: SET_THEME_PREFERENCE, variables: { mode } })
        .catch(() => {}); // never break the UI over a theme sync
    });
    return () => registerThemePersister(null);
  }, [user?.id, client]);

  return null;
};

export const ThemeToggleButton = () => {
  const { mode, setMode } = useThemeMode();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleSelect = (newMode) => {
    setMode(newMode);
    handleClose();
  };

  const getIcon = () => {
    if (mode === 'system') return <SettingsBrightnessIcon />;
    return mode === 'light' ? <Brightness7Icon /> : <Brightness4Icon />;
  };

  return (
    <>
      <Tooltip title="Theme settings">
        <IconButton
          onClick={handleClick}
          color="inherit"
          sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary', bgcolor: 'action.hover' } }}
        >
          {getIcon()}
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{ paper: { sx: { minWidth: 140, mt: 1, borderRadius: 2 } } }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => handleSelect('light')} selected={mode === 'light'}>
          <ListItemIcon><Brightness7Icon fontSize="small" /></ListItemIcon>
          <ListItemText>Light</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleSelect('dark')} selected={mode === 'dark'}>
          <ListItemIcon><Brightness4Icon fontSize="small" /></ListItemIcon>
          <ListItemText>Dark</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleSelect('system')} selected={mode === 'system'}>
          <ListItemIcon><SettingsBrightnessIcon fontSize="small" /></ListItemIcon>
          <ListItemText>System</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

