import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Divider from '@mui/material/Divider';
import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_PUBLIC_CONFIG } from '../graphql/queries';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import HistoryIcon from '@mui/icons-material/History';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import EventNoteIcon from '@mui/icons-material/EventNote';
import EventIcon from '@mui/icons-material/Event';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import MedicationIcon from '@mui/icons-material/Medication';
import { useAuth } from '../shared/auth/AuthContext';
import { usePageAccess } from '../shared/auth/hooks';
import {
  DRAWER_WIDTH,
  DRAWER_COLLAPSED_WIDTH,
  NAV_ITEMS_STAFF,
  NAV_ITEMS_ADMIN,
} from '../shared/constants';
import { COLORS } from '../theme/tokens/colors';

const iconMap = {
  Dashboard: DashboardIcon,
  CameraAlt: CameraAltIcon,
  History: HistoryIcon,
  AdminPanelSettings: AdminPanelSettingsIcon,
  People: PeopleIcon,
  Settings: SettingsIcon,
  LocationOn: LocationOnIcon,
  EventNote: EventNoteIcon,
  Event: EventIcon,
  FactCheck: FactCheckIcon,
  LocalPharmacy: LocalPharmacyIcon,
  FolderShared: FolderSharedIcon,
  Medication: MedicationIcon,
};

const Sidebar = ({ open, onClose, variant = 'permanent', collapsed = false }) => {
  const { user, isAdmin } = useAuth();
  const { canAccessPage } = usePageAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();

  const { data: configData } = useQuery(GET_PUBLIC_CONFIG, { fetchPolicy: 'cache-and-network' });
  const appConfig = configData?.publicConfig || { organizationName: '', appLogo: null };

  const isDark = theme.palette.mode === 'dark';
  const [expanded, setExpanded] = useState({
    'User Management': true,
    'Operations & Medical': true,
    'My Records': true,
    'Operations': true,
  });

  const handleToggle = (groupTitle) => {
    setExpanded(prev => ({ ...prev, [groupTitle]: !prev[groupTitle] }));
  };

  const adminGroups = [
    { title: null, items: ['/'] },
    { title: 'User Management', items: ['/staff', '/approvals', '/history', '/holidays'] },
    { title: 'Operations & Medical', items: ['/stock', '/medicines', '/offices', '/documents', '/settings'] }
  ];

  const staffGroups = [
    { title: null, items: ['/', '/attendance'] },
    { title: 'My Records', items: ['/history', '/leaves'] },
    { title: 'Operations', items: ['/stock', '/documents'] }
  ];

  const groups = isAdmin ? adminGroups : staffGroups;

  // Pages withdrawn by an admin (restrictedPages[]) disappear from the rail too
  const navItems = (isAdmin ? NAV_ITEMS_ADMIN : NAV_ITEMS_STAFF).filter((item) =>
    canAccessPage(item.path)
  );

  // Gmail / Notion-style soft focus pill – every value resolves from the
  // theme palette, so light & dark stay consistent automatically
  const ACTIVE_PILL_BG = 'action.selected';
  const ACTIVE_TEXT = isDark ? 'primary.main' : 'primary.dark';

  // Rail mode = collapsed desktop sidebar (icons only; labels become tooltips)
  const isRail = variant === 'permanent' && collapsed;
  const width = isRail ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH;

  // Navigate + auto-close the temporary drawer on mobile
  const go = (path) => {
    navigate(path);
    if (variant === 'temporary') onClose?.();
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo / Brand */}
      <Tooltip
        title={isRail ? appConfig.organizationName : ''}
        disableHoverListener={!isRail}
        placement="right"
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent={isRail ? 'center' : 'flex-start'}
          spacing={1.5}
          sx={{ 
            px: isRail ? 1 : 2.5, 
            height: 100, 
            borderBottom: '1px solid', 
            borderColor: 'divider',
            cursor: 'pointer' 
          }}
          onClick={() => go('/')}
        >
          {appConfig.appLogo ? (
            <Avatar src={appConfig.appLogo} alt={appConfig.organizationName} sx={{ width: 44, height: 44, flexShrink: 0, bgcolor: 'transparent' }} />
          ) : (
            <Avatar sx={{ width: 40, height: 40, flexShrink: 0, color: 'primary.main', bgcolor: 'transparent' }}>
              <LocalHospitalIcon />
            </Avatar>
          )}
          {!isRail && (
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.1, color: 'text.primary', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                {appConfig.organizationName}
              </Typography>
            </Box>
          )}
        </Stack>
      </Tooltip>

      <List 
        sx={{ 
          px: isRail ? 1 : 1.5, 
          py: 1,
          flex: 1,
          overflowX: 'hidden',
          overflowY: 'hidden',
          '&:hover': { overflowY: 'auto' },
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(150,150,150,0.4)', borderRadius: 4 },
        }}
      >
        {groups.map((group, idx) => {
          const groupNavItems = group.items.map(path => navItems.find(i => i.path === path)).filter(Boolean);
          if (groupNavItems.length === 0) return null;

          return (
            <React.Fragment key={idx}>
              {group.title && !isRail && (
                <ListItemButton 
                  onClick={() => handleToggle(group.title)} 
                  disableRipple
                  sx={{ 
                    borderRadius: 1, 
                    mb: 0.1, 
                    mt: idx > 0 ? 1 : 0,
                    py: 0.25,
                    minHeight: 28,
                    '& .group-arrow': { opacity: 0, transition: 'opacity 0.2s ease' },
                    '&:hover .group-arrow': { opacity: 1 },
                    '&:hover': { bgcolor: 'transparent' } // Keep bg clean
                  }}
                >
                  <ListItemText 
                    primary={group.title} 
                    primaryTypographyProps={{ 
                      fontSize: '0.65rem', 
                      fontWeight: 700, 
                      color: 'text.disabled', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.06em' 
                    }} 
                  />
                  {expanded[group.title] 
                    ? <ExpandLess className="group-arrow" sx={{color: 'text.secondary', fontSize: 16}} /> 
                    : <ExpandMore className="group-arrow" sx={{color: 'text.secondary', fontSize: 16}} />}
                </ListItemButton>
              )}
              {group.title && isRail && (
                <Divider sx={{ my: 1, borderColor: 'divider' }} />
              )}
              <Collapse in={!group.title || isRail || expanded[group.title]} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {groupNavItems.map((item) => {
                    const Icon = iconMap[item.icon] || DashboardIcon;
                    const isActive = location.pathname === item.path;

                    const navButton = (
                      <ListItemButton
                        onClick={() => go(item.path)}
                        sx={{
                          borderRadius: 1,
                          justifyContent: isRail ? 'center' : 'flex-start',
                          minHeight: 32,
                          px: isRail ? 1 : 1.5,
                          bgcolor: isActive ? ACTIVE_PILL_BG : 'transparent',
                          color: isActive ? ACTIVE_TEXT : 'text.secondary',
                          transition: 'all 0.1s ease',
                          mb: 0.1,
                          '&:hover': {
                            bgcolor: isActive ? ACTIVE_PILL_BG : 'action.hover',
                            color: isActive ? ACTIVE_TEXT : 'text.primary',
                          },
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color: isActive ? ACTIVE_TEXT : 'text.secondary',
                            minWidth: isRail ? 0 : 32,
                            justifyContent: 'center',
                          }}
                        >
                          <Icon sx={{ fontSize: 18 }} />
                        </ListItemIcon>
                        {!isRail && (
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{
                              fontSize: '0.8rem',
                              fontWeight: isActive ? 600 : 400,
                            }}
                          />
                        )}
                      </ListItemButton>
                    );

                    return (
                      <ListItem key={item.path} disablePadding>
                        {isRail ? (
                          <Tooltip title={item.label} placement="right" arrow>
                            {navButton}
                          </Tooltip>
                        ) : (
                          navButton
                        )}
                      </ListItem>
                    );
                  })}
                </List>
              </Collapse>
            </React.Fragment>
          );
        })}
      </List>

      {/* User Info at Bottom */}
      <Box sx={{ mt: 'auto', p: isRail ? 1 : 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Tooltip
          title={isRail ? `${user?.name || 'User'} • ${user?.role || ''}` : ''}
          disableHoverListener={!isRail}
          placement="right"
        >
          <Box
            sx={{
              p: isRail ? 0.75 : 1.25,
              borderRadius: 1,
              bgcolor: 'background.default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isRail ? 'center' : 'flex-start',
              gap: 1.25,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' }
            }}
          >
            <Avatar
              src={user?.avatar}
              sx={{
                color: 'primary.contrastText',
                bgcolor: 'primary.main',
                width: 32,
                height: 32,
                fontSize: '0.8125rem',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {!user?.avatar && (user?.name?.charAt(0) || 'U')}
            </Avatar>
            {!isRail && (
              <Box sx={{ overflow: 'hidden', flex: 1 }}>
                <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.8125rem', color: 'text.primary' }}>
                  {user?.name || 'User'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6875rem' }} noWrap>
                  {user?.employeeId} • {user?.role}
                </Typography>
              </Box>
            )}
          </Box>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={variant}
      open={open}
      onClose={onClose}
      sx={{
        width,
        flexShrink: 0,
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          overflowX: 'hidden',
          overflowY: 'hidden',
          transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          // Clean neutral chrome – white rail (light) / graphite rail (dark).
          // The Gmail–Notion rule: neutral surfaces, colour only as accent.
          backgroundColor: isDark ? COLORS.sidebarBgDark : COLORS.sidebarBgLight,
          backgroundImage: 'none',
          borderRight: `1px solid ${isDark ? COLORS.borderDark : COLORS.borderLight}`,
          boxShadow: 'none',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default Sidebar;




