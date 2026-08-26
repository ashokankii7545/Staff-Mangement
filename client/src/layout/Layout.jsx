import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppErrorBoundary } from '../shared/lib/ErrorHandler';
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BreadcrumbBar from './BreadcrumbBar';
import { useAuth } from '../shared/auth/AuthContext';
import { ThemeSync } from '../theme/ThemeContext';

const Layout = () => {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Desktop sidebar collapse – persisted so the choice survives page reloads
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  );
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const toggleCollapsed = () =>
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });

  // One button, context-aware behaviour: drawer toggle on mobile,
  // collapse/expand the pinned rail on desktop
  const handleToggleSidebar = () =>
    isMobile ? setMobileOpen((prev) => !prev) : toggleCollapsed();

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      {/* Keeps UI theme in sync with the user's server-stored preference */}
      <ThemeSync user={user} />
      {/* Sidebar – pinned on desktop, drawer on mobile */}
      {isMobile ? (
        <AppErrorBoundary variant="component">
          <Sidebar
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
          />
        </AppErrorBoundary>
      ) : (
        <AppErrorBoundary variant="component">
          <Sidebar
            variant="permanent"
            open
            collapsed={collapsed}
            onToggleCollapse={toggleCollapsed}
          />
        </AppErrorBoundary>
      )}

      {/* Main Content Column */}
      <Box
        component="main"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          height: '100%',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Pinned Header (static, no spacer needed) */}
        <AppErrorBoundary variant="component">
          <Topbar
            onMenuClick={() => setMobileOpen(true)}
            onToggleSidebar={handleToggleSidebar}
            sidebarCollapsed={!isMobile && collapsed}
          />
        </AppErrorBoundary>

        {/* Breadcrumb strip – pinned DIRECTLY BELOW the header (never scrolls) */}
        <AppErrorBoundary variant="component">
          <BreadcrumbBar />
        </AppErrorBoundary>

        {/* Scrollable Content Area – THE ONLY THING THAT SCROLLS */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            scrollbarGutter: 'stable',
            p: { xs: 2, sm: 3 },
          }}
        >
          <AppErrorBoundary variant="component">
            <Outlet />
          </AppErrorBoundary>
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
