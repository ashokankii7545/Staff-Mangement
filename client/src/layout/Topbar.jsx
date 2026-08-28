import React, { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CheckIcon from '@mui/icons-material/Check';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/auth/AuthContext';
import NotificationCenter from '../features/notifications/components/NotificationCenter';
import { useThemeMode } from '../theme/ThemeContext';
import { useAppMutation } from '../shared/hooks';
import { GenericDialog, GenericFormEngine, useNotification } from '../shared/ui';
import { CHANGE_PASSWORD } from '../graphql/mutations';
import { z } from 'zod';
import LockResetOutlinedIcon from '@mui/icons-material/LockResetOutlined';

const PASSWORD_FIELDS = [
  { name: 'currentPassword', type: 'password', label: 'Current Password (skip if you sign in with Google)', gridSize: { xs: 12 } },
  { name: 'newPassword', type: 'password', label: 'New Password', helperText: 'Minimum 8 characters with letters & numbers', gridSize: { xs: 12 } },
  { name: 'confirmPassword', type: 'password', label: 'Confirm New Password', gridSize: { xs: 12 } },
];

const passwordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .min(8, 'Minimum 8 characters')
      .regex(/[A-Za-z]/, 'Must contain a letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

const Topbar = ({ onMenuClick, onToggleSidebar, sidebarCollapsed = false }) => {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  // Theme lives INSIDE the avatar menu now – one click on your own profile,
  // no extra icon cluttering the bar.
  const { mode: themeMode, setMode } = useThemeMode();
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);
  const [pwOpen, setPwOpen] = useState(false);
  const notify = useNotification();

  const [changePassword, { loading: changingPw }] = useAppMutation(CHANGE_PASSWORD, {
    successMessage: 'Password updated successfully',
    onCompleted: () => setPwOpen(false),
    onError: (err) => notify.error(err.message),
  });

  const handleProfileClick = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const handleNavigate = (path) => { handleMenuClose(); navigate(path); };
  const handleLogout = () => { handleMenuClose(); logout(); };

  return (
    <>
      <AppBar
      position="static"
      elevation={0}
      sx={{ flexShrink: 0 }}
    >
      <Toolbar sx={{ height: 60, minHeight: '60px !important', px: { xs: 2, sm: 3 }, gap: 0.5 }}>
        {/* Sidebar toggle – opens/closes the drawer on mobile, collapses the
            rail on desktop. ALWAYS visible so the sidebar is never stuck. */}
        <Tooltip
          title={isMobile ? 'Toggle menu' : sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <IconButton
            edge="start"
            onClick={() => (onToggleSidebar ? onToggleSidebar() : onMenuClick?.())}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            sx={{
              mr: 0.5,
              color: 'text.secondary',
              '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
            }}
          >
            {isMobile || sidebarCollapsed ? <MenuIcon /> : <MenuOpenIcon />}
          </IconButton>
        </Tooltip>

        <Box sx={{ flexGrow: 1 }} />

        <Stack direction="row" alignItems="center" spacing={1}>
          <NotificationCenter />

          {/* User Profile */}
          <Box
            onClick={handleProfileClick}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 0.5,
              pr: 1,
              borderRadius: 2,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
              bgcolor: menuOpen ? 'action.hover' : 'transparent',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Avatar
              src={user?.avatar}
              sx={{
                bgcolor: 'primary.main',
                color: '#fff',
                width: 32,
                height: 32,
                fontSize: '0.8125rem',
                fontWeight: 600,
              }}
            >
              {!user?.avatar && (user?.name?.charAt(0) || 'U')}
            </Avatar>

            <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left' }}>
              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.2 }}>
                {user?.name || 'Account'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6875rem' }}>
                {isAdmin ? 'Administrator' : user?.department || 'Staff'}
              </Typography>
            </Box>

            <KeyboardArrowDownIcon
              sx={{
                fontSize: 16,
                color: 'text.secondary',
                transform: menuOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s ease',
              }}
            />
          </Box>

          {/* Dropdown */}
          <Menu
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={handleMenuClose}
            onClick={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            slotProps={{
              paper: {
                elevation: 0,
                sx: {
                  width: 240,
                  mt: 1,
                  p: 0.5,
                },
              },
            }}
          >
            <Box sx={{ px: 1.5, py: 1.25 }}>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                {user?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                {user?.email || `${user?.employeeId?.toLowerCase()}@company.com`}
              </Typography>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Chip
                  label={isAdmin ? 'ADMIN' : 'STAFF'}
                  size="small"
                  sx={{
                    bgcolor: 'action.selected',
                    color: 'primary.main',
                    fontWeight: 700,
                    fontSize: '0.625rem',
                    height: 20,
                    borderRadius: 1,
                  }}
                />
                <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace', fontWeight: 600 }}>
                  {user?.employeeId}
                </Typography>
              </Stack>
            </Box>

            <Divider sx={{ my: 0.5 }} />

            {/* Staff self-service profile – everything they can view in one place */}
            {!isAdmin && (
              <MenuItem onClick={() => handleNavigate('/profile')} sx={{ borderRadius: 1.5, py: 1 }}>
                <ListItemIcon sx={{ minWidth: 32, color: 'text.secondary' }}>
                  <PersonOutlineIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="My Profile" primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 500 }} />
              </MenuItem>
            )}

            {isAdmin ? (
              <MenuItem onClick={() => handleNavigate('/settings')} sx={{ borderRadius: 1.5, py: 1 }}>
                <ListItemIcon sx={{ minWidth: 32, color: 'text.secondary' }}>
                  <SettingsOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Settings" primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 500 }} />
              </MenuItem>
            ) : (
              <MenuItem onClick={() => handleNavigate('/leaves')} sx={{ borderRadius: 1.5, py: 1 }}>
                <ListItemIcon sx={{ minWidth: 32, color: 'text.secondary' }}>
                  <EventNoteOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="My Leaves" primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 500 }} />
              </MenuItem>
            )}

            <MenuItem onClick={() => handleNavigate('/history')} sx={{ borderRadius: 1.5, py: 1 }}>
              <ListItemIcon sx={{ minWidth: 32, color: 'text.secondary' }}>
                <PersonOutlineIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={isAdmin ? 'All Records' : 'My History'} primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 500 }} />
            </MenuItem>

            {/* Appearance – Light / Dark / System inside the profile menu */}
            <Divider sx={{ my: 0.5 }} />
            <Typography
              variant="caption"
              sx={{ px: 1.5, pt: 0.75, pb: 0.25, display: 'block', fontWeight: 700, letterSpacing: '0.06em', color: 'text.disabled' }}
            >
              APPEARANCE
            </Typography>
            {[
              { mode: 'light', label: 'Light', Icon: Brightness7Icon },
              { mode: 'dark', label: 'Dark', Icon: Brightness4Icon },
              { mode: 'system', label: 'System', Icon: SettingsBrightnessIcon },
            ].map(({ mode: m, label, Icon }) => (
              <MenuItem
                key={m}
                onClick={() => setMode(m)}
                selected={themeMode === m}
                sx={{ borderRadius: 1.5, py: 0.75 }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: 'text.secondary' }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={label} primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 500 }} />
                {themeMode === m && (
                  <CheckIcon fontSize="small" sx={{ color: 'primary.main', mr: 0.5 }} />
                )}
              </MenuItem>
            ))}

            <Divider sx={{ my: 0.5 }} />

            <MenuItem
              onClick={() => {
                handleMenuClose();
                setPwOpen(true);
              }}
              sx={{ borderRadius: 1.5, py: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 32, color: 'text.secondary' }}>
                <LockResetOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Change Password" primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 500 }} />
            </MenuItem>

            <MenuItem onClick={handleLogout} sx={{ borderRadius: 1.5, py: 1, color: 'error.main', '&:hover': { bgcolor: 'error.light' } }}>
              <ListItemIcon sx={{ minWidth: 32, color: 'error.main' }}>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Sign Out" primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 600, color: 'error.main' }} />
            </MenuItem>
          </Menu>
        </Stack>
      </Toolbar>
    </AppBar>

      {/* Change Password – standard ESS security feature, both roles */}
      <GenericDialog
        open={pwOpen}
        onClose={() => !changingPw && setPwOpen(false)}
        title="Change Password"
        maxWidth="xs"
      >
        <GenericFormEngine
          fields={PASSWORD_FIELDS}
          schema={passwordSchema}
          submitLabel="Update Password"
          hideReset
          onSubmit={async (values) => {
            await changePassword({
              variables: {
                currentPassword: values.currentPassword || null,
                newPassword: values.newPassword,
              },
            });
          }}
        />
      </GenericDialog>
    </>
  );
};

export default Topbar;


