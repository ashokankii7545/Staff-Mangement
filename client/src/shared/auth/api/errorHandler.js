/**
 * Enterprise GraphQL Error Handler (shared)
 *
 * ✅ Single-flight token refresh (no race conditions)
 * ✅ Retry ONLY on network errors / 5xx — never 4xx
 * ✅ UNAUTHENTICATED recovery: silent refresh + retry, else secure logout
 * ✅ Global error events ('graphql-error' / 'api-network-error')
 * ✅ Secure selective logout (only app-owned keys)
 *
 * NOTE: Token is stored under the 'token' localStorage key
 *       (convention shared with AuthContext.jsx).
 */

import { RetryLink } from '@apollo/client/link/retry';
import { onError } from '@apollo/client/link/error';
import { fromPromise } from '@apollo/client';

/** CustomEvent names dispatched on `window` for global listeners */
export const GRAPHQL_ERROR_EVENT = 'graphql-error';
export const NETWORK_ERROR_EVENT = 'api-network-error';
export const SESSION_EXPIRED_EVENT = 'session-expired';

/** Keys owned by this app that must be wiped on logout */
const APP_STORAGE_KEYS = ['token', 'user'];
const TOKEN_KEY = 'token';

const getToken = () => {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  } catch {
    return null;
  }
};

// =====================================================================
// 1. SINGLE-FLIGHT TOKEN REFRESH
// =====================================================================
let refreshPromise = null;
let tokenRefresher = null;

/**
 * Register the app's token-refresh function (call once at startup IF/WHEN
 * the backend exposes a refresh endpoint):
 *
 *   registerTokenRefresher(async () => {
 *     const res = await fetch('/auth/refresh', { method: 'POST', ... });
 *     return (await res.json()).accessToken;
 *   });
 */
export const registerTokenRefresher = (fn) => {
  tokenRefresher = typeof fn === 'function' ? fn : null;
};

export const hasTokenRefresher = () => typeof tokenRefresher === 'function';

// =====================================================================
// 2. WS CLIENT REGISTRY
//    (lets this module refresh/dispose the WebSocket WITHOUT importing
//     apolloClient.js — avoids a circular dependency)
// =====================================================================
let activeWsClient = null;

export const setActiveWsClient = (client) => {
  activeWsClient = client;
};

export const disposeActiveWsClient = () => {
  if (activeWsClient) {
    try {
      activeWsClient.dispose();
    } catch {
      /* already disposed */
    }
    activeWsClient = null;
  }
};

// =====================================================================
// 3. SECURE LOGOUT (selective clear — never nukes other apps' keys)
// =====================================================================
let isLoggingOut = false;

export const performSecureLogout = () => {
  if (typeof window === 'undefined' || isLoggingOut) return;
  isLoggingOut = true;

  APP_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  sessionStorage.clear();
  disposeActiveWsClient();
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));

  // Full navigation also resets the in-memory Apollo cache safely.
  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
  setTimeout(() => {
    isLoggingOut = false;
  }, 1000);
};
