import { ApolloProvider } from '@apollo/client';
import { AppNotificationProvider } from './shared/ui';
import { GoogleOAuthProvider } from '@react-oauth/google';

import client from './shared/api/apolloClient';
import { AppThemeProvider } from './theme/ThemeContext';
import { AuthProvider, useAuth } from './shared/auth/AuthContext';
import Layout from './layout/Layout';
import { ApiErrorListener, NetworkAlert } from './shared/ui';
import { AppErrorBoundary } from './shared/lib/ErrorHandler';
import { AppRouter } from './shared/routes/AppRouter';

import { Navigate } from 'react-router-dom';

// ------------------------------------------------------------
// ROUTE CONFIGURATION
// ------------------------------------------------------------
const AuthLayout = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const appRoutes = [
  {
    path: '/login',
    meta: { layout: AuthLayout },
    load: () => import('./features/auth/LoginPage'),
  },
  {
    path: '/',
    meta: {
      requiresAuth: true,
      layout: Layout,
    },
    children: [
      {
        path: '',
        load: () => import('./features/dashboard/DashboardPage'),
      },
      {
        path: 'attendance',
        meta: { requiresAuth: true, pageKey: '/attendance' },
        load: () => import('./features/attendance/AttendancePage'),
      },
      {
        path: 'history',
        meta: { requiresAuth: true, pageKey: '/history' },
        load: () => import('./features/history/HistoryPage'),
      },
      {
        path: 'leaves',
        meta: { requiresAuth: true, pageKey: '/leaves' },
        load: () => import('./features/leaves/MyLeaves'),
      },
      {
        path: 'stock',
        meta: { requiresAuth: true, pageKey: '/stock' },
        load: () => import('./features/medicine/MedicineRequestsPage'),
      },
      {
        path: 'documents',
        meta: { requiresAuth: true, pageKey: '/documents' },
        load: () => import('./features/documents/DocumentsPage'),
      },
      {
        path: 'admin',
        meta: { requiresAuth: true, pageKey: '/admin', allowedRoles: ['ADMIN'] },
        load: () => import('./features/admin/AdminDashboard'),
      },
      {
        path: 'staff',
        meta: { requiresAuth: true, pageKey: '/staff', allowedRoles: ['ADMIN'] },
        load: () => import('./features/admin/StaffManagement'),
      },
      {
        path: 'offices',
        meta: { requiresAuth: true, pageKey: '/offices', allowedRoles: ['ADMIN'] },
        load: () => import('./features/admin/OfficeManagement'),
      },
      {
        path: 'holidays',
        meta: { requiresAuth: true, pageKey: '/holidays', allowedRoles: ['ADMIN'] },
        load: () => import('./features/admin/HolidaysManagement'),
      },
      {
        path: 'approvals',
        meta: { requiresAuth: true, pageKey: '/approvals', allowedRoles: ['ADMIN'] },
        load: () => import('./features/admin/ApprovalsPage'),
      },
      {
        path: 'settings',
        meta: { requiresAuth: true, pageKey: '/settings', allowedRoles: ['ADMIN'] },
        load: () => import('./features/admin/SettingsPage'),
      },
    ],
  },
];

// ------------------------------------------------------------
// APP ENTRY
// ------------------------------------------------------------
const GOOGLE_CLIENT_ID = '9070392832-hrjuce7mrav54tlem6jflikc38k7dh4d.apps.googleusercontent.com';

const App = () => (
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <AppErrorBoundary variant="full">
      <ApolloProvider client={client}>
        <AppThemeProvider>
          <AppNotificationProvider>
            <ApiErrorListener />
            <NetworkAlert />
            <AuthProvider>
              <AppRouter routes={appRoutes} />
            </AuthProvider>
          </AppNotificationProvider>
        </AppThemeProvider>
      </ApolloProvider>
    </AppErrorBoundary>
  </GoogleOAuthProvider>
);

export default App;




