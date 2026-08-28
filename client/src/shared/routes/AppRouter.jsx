import React, { Suspense, lazy } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  useLocation,
  useRouteError,
  useNavigate,
  Outlet
} from 'react-router-dom';
import { Box, Button, Stack, Container } from '@mui/material';
import { useAuth } from '../auth/AuthContext';
import { useRoles, usePageAccess } from '../auth/hooks';
import { AppErrorBoundary } from '../lib/ErrorHandler';
import { AdvancedLoader } from '../ui/AdvancedLoader';
import { EmptyState } from '../ui';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

// ------------------------------------------------------------
// 1. PROTECTED ROUTE (Auth + Role Guard)
// ------------------------------------------------------------
export const ProtectedRoute = ({ children, allowedRoles = [], pageKey }) => {
  const { isAuthenticated } = useAuth();
  const { hasAnyRole } = useRoles();
  const { canAccessPage } = usePageAccess();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0) {
    // Determine user role (defaults to user?.role which is 'ADMIN' or undefined/staff)
    const hasRole = hasAnyRole(allowedRoles);
    if (!hasRole) {
      return <Navigate to="/403" replace />;
    }
  }

  // Admin-withdrawn page for this specific account (restrictedPages[])
  if (!canAccessPage(pageKey)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
};

// ------------------------------------------------------------
// 2. ROUTE ERROR BOUNDARY
// ------------------------------------------------------------
export const RouteErrorBoundary = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  const isNotFound = error?.status === 404;
  const description =
    error?.message ||
    error?.statusText ||
    (isNotFound
      ? 'The page you are looking for does not exist or has been moved.'
      : 'An unexpected error occurred while loading this page.');

  return (
    <Container maxWidth="sm">
      <EmptyState
        variant="error"
        icon={isNotFound ? SearchOffIcon : ErrorOutlineIcon}
        title={isNotFound ? 'Page Not Found' : 'Something went wrong'}
        description={description}
        sx={{ py: 8 }}
        action={
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="center">
            {/* Client-side navigate – NO hard reload, sidebar/topbar stay intact */}
            <Button variant="contained" onClick={() => navigate('/')}>
              Go to Dashboard
            </Button>
            <Button variant="outlined" onClick={() => navigate(-1)}>
              Go Back
            </Button>
            <Button variant="text" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </Stack>
        }
      />
    </Container>
  );
};

// ------------------------------------------------------------
// 3. LAZY LOADER – enterprise gradient fallback (no raw spinners)
// ------------------------------------------------------------
export const LazyLoader = (importFunc) => {
  // Normalize the dynamic import: React.lazy REQUIRES `{ default: Component }`.
  // A route module without a default export used to crash with the cryptic
  // "TypeError: Cannot convert object to primitive value" (Vite module
  // namespace objects have a null prototype, so React's dev warning formatter
  // explodes while trying to print them). We now resolve the component safely
  // and throw a READABLE error if nothing usable is exported.
  const LazyComponent = lazy(() =>
    Promise.resolve(importFunc()).then((mod) => {
      const Component =
        mod?.default ??
        Object.values(mod ?? {}).find((value) => typeof value === 'function');
      if (!Component) {
        throw new Error(
          'Route module has no default export. Add `export default PageName;` to it.'
        );
      }
      return { default: Component };
    })
  );
  return function LazyWrapper(props) {
    return (
      <Suspense
        fallback={
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <AdvancedLoader isLoading variant="gradient" message="Loading…" />
          </Box>
        }
      >
        <AppErrorBoundary variant="component">
           <LazyComponent {...props} />
        </AppErrorBoundary>
      </Suspense>
    );
  };
};

// ------------------------------------------------------------
// 4. MAIN ROUTER BUILDER
// ------------------------------------------------------------
import { TelemetryTracker } from '../lib/TelemetryTracker';

export const buildRouter = (routes) => {
  const mapRoutes = (routeConfigs) => {
    return routeConfigs.map((route) => {
      let element;
      if (route.load) {
        const LazyComp = LazyLoader(route.load);
        element = <LazyComp />;
      } else {
        element = route.element;
      }

      if (route.meta?.layout) {
        const Layout = route.meta.layout;
        element = <Layout>{element}</Layout>;
      } else if (route.children && route.children.length > 0 && !element) {
        // Fallback layout if none provided but has children
        element = <Outlet />;
      }

      if (route.meta?.requiresAuth) {
        element = (
          <ProtectedRoute
            allowedRoles={route.meta.allowedRoles}
            pageKey={route.meta.pageKey}
          >
            {element}
          </ProtectedRoute>
        );
      }

      return {
        path: route.path,
        element,
        errorElement: <RouteErrorBoundary />,
        children: route.children ? mapRoutes(route.children) : undefined,
      };
    });
  };

  const mappedRoutes = mapRoutes(routes);

  // 404 / 403 live INSIDE the authenticated layout so the sidebar + topbar
  // remain visible – error screens no longer take over the full window.
  const layoutRoute = mappedRoutes.find((route) => route.path === '/');
  if (layoutRoute) {
    layoutRoute.children.push(
      // Legacy alias: old breadcrumbs/code pointed at /dashboard which never
      // existed – silently land users on the real dashboard instead of a 404.
      { path: 'dashboard', element: <Navigate to="/" replace /> },
      { path: '404', element: <NotFoundPage /> },
      { path: '403', element: <ForbiddenPage /> }
    );
  }

  // Any unknown URL funnels into the in-layout 404
  mappedRoutes.push({ path: '*', element: <Navigate to="/404" replace /> });

  return createBrowserRouter([
    {
      element: (
        <>
          <TelemetryTracker />
          <Outlet />
        </>
      ),
      children: mappedRoutes
    }
  ]);
};

export const AppRouter = ({ routes }) => {
  const router = React.useMemo(() => buildRouter(routes), [routes]);
  return <RouterProvider router={router} />;
};

// ------------------------------------------------------------
// 5. FALLBACK PAGES – powered by shared EmptyState
// ------------------------------------------------------------
/**
 * Client-side navigation for fallback actions – a plain <a href="/"> would
 * hard-reload the entire SPA (slow, loses Apollo cache & scroll position),
 * so these buttons use the router instead.
 */
const GoHomeAction = ({ label = 'Go to Dashboard' }) => {
  const navigate = useNavigate();
  return (
    <Button variant="contained" onClick={() => navigate('/')} sx={{ mt: 2 }}>
      {label}
    </Button>
  );
};

export const NotFoundPage = () => (
  <EmptyState
    variant="empty"
    title="Page Not Found"
    description="The page you are looking for doesn't exist or has been moved."
    action={<GoHomeAction />}
    sx={{ py: 8 }}
  />
);

export const ForbiddenPage = () => (
  <EmptyState
    variant="permission"
    title="403 – Forbidden"
    description="You don't have permission to access this page."
    action={<GoHomeAction label="Back to Safety" />}
    sx={{ py: 8 }}
  />
);
