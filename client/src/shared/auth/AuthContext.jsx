import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useApolloClient } from '@apollo/client';
import { logger } from '../lib/logger';
import { subscribeToSessionExpired } from '../api/errorHandler';
import { GET_ME } from '../../graphql/queries';

const AuthContext = createContext(null);

// Keep React auth state in sync when the Apollo error handler force-logs-out
// (e.g. expired token, WS rejected with 4401/4403).
const useSessionExpiredSync = (onExpired) => {
  useEffect(() => subscribeToSessionExpired(onExpired), [onExpired]);
};

export const AuthProvider = ({ children }) => {
  const apolloClient = useApolloClient();
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  // If the global error handler force-clears the session (expired token /
  // unauthorized WS), mirror it into React state so ProtectedRoute reacts.
  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setToken(null);
  }, []);
  useSessionExpiredSync(handleSessionExpired);

  const login = useCallback((userData, authToken, refreshToken) => {
    setUser(userData);
    setToken(authToken);
    logger.setCorrelationId(userData?.id || 'UNKNOWN');
    logger.info('User logged in successfully', { email: userData?.email, role: userData?.role });
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', authToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    apolloClient.resetStore();
    logger.info('User logged out');
    logger.clearCorrelationId();
  }, [apolloClient]);

  /** Merge server-side profile changes (page restrictions, theme…) into state */
  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      if (!prev || !patch) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  }, []);

  // Keep the cached profile fresh: restrictions or role tweaks made by an
  // admin reach this device on the next app load WITHOUT a manual re-login.
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    apolloClient
      .query({ query: GET_ME, fetchPolicy: 'network-only' })
      .then((res) => {
        if (!cancelled && res?.data?.me) updateUser(res.data.me);
      })
      .catch(() => {}); // offline / expired – silent, login flow handles it
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const isAdmin = useMemo(() => user?.role === 'ADMIN', [user]);
  const isAuthenticated = useMemo(() => !!token, [token]);

  const value = useMemo(
    () => ({ user, token, login, logout, updateUser, isAdmin, isAuthenticated }),
    [user, token, login, logout, updateUser, isAdmin, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};


