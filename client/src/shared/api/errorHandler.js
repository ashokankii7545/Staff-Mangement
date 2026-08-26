import { RetryLink } from '@apollo/client/link/retry';
import { onError } from '@apollo/client/link/error';
import { fromPromise, Observable } from '@apollo/client';

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

/**
 * Returns a SHARED promise so N concurrent 401s trigger exactly ONE refresh.
 */
export const getRefreshedToken = () => {
  if (!hasTokenRefresher()) {
    return Promise.reject(new Error('No token refresher registered'));
  }
  if (!refreshPromise) {
    refreshPromise = Promise.resolve()
      .then(() => tokenRefresher())
      .then((token) => {
        if (!token) throw new Error('Token refresher returned an empty token');
        localStorage.setItem(TOKEN_KEY, token);
        disposeActiveWsClient(); // next subscription reconnects with fresh token
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

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

// =====================================================================
// 4. RETRY LINK (network errors / 5xx only — NEVER 4xx)
// =====================================================================
const getStatus = (error) =>
  error?.statusCode ?? error?.response?.status ?? null;

export const retryLink = new RetryLink({
  delay: { initial: 300, max: 5000, jitter: true },
  attempts: {
    max: 3,
    retryIf: (error) => {
      if (!error) return false;
      const status = getStatus(error);
      // 4xx (bad request, auth, validation...) must fail fast — no retry.
      if (status !== null && status < 500) return false;
      // Retry real network failures (no status) and 5xx server errors.
      return true;
    },
  },
});

// =====================================================================
// 5. ERROR LINK (silent refresh + global error dispatch)
// =====================================================================
const isUnauthenticatedGraphQL = (err) =>
  err?.extensions?.code === 'UNAUTHENTICATED' ||
  /jwt expired|invalid token|not authenticated|unauthorized/i.test(
    err?.message || ''
  );

const isUnauthenticatedNetwork = (networkError) => {
  const status = getStatus(networkError);
  return status === 401 || status === 403;
};

/**
 * Refresh-once-and-retry flow. Falls back to secure logout when no
 * refresher is registered or when the refresh itself fails.
 */
const recoverSession = (operation, forward) => {
  // Anonymous context (e.g. wrong credentials typed on the Login page):
  // there is NO session to recover — let the operation fail normally so
  // the UI can show its own message (and no redirect loop happens).
  if (!getToken()) {
    return forward(operation);
  }

  // No refresh endpoint wired yet → treat as session expiry.
  if (!hasTokenRefresher()) {
    performSecureLogout();
    // Operation is intentionally left dangling; the app redirects above.
    return new Observable(() => {});
  }

  return fromPromise(
    getRefreshedToken().catch(() => {
      performSecureLogout();
    })
  ).flatMap(() => {
    const oldHeaders = operation.getContext().headers || {};
    const token = getToken();
    operation.setContext({
      headers: {
        ...oldHeaders,
        authorization: token ? `Bearer ${token}` : '',
      },
    });
    return forward(operation);
  });
};

export const errorLink = onError(
  ({ graphQLErrors, networkError, operation, forward }) => {
    // -- GraphQL errors ----------------------------------------------
    if (graphQLErrors?.length) {
      const unauthenticated = graphQLErrors.find(isUnauthenticatedGraphQL);

      if (unauthenticated) {
        return recoverSession(operation, forward);
      }

      graphQLErrors.forEach((err) => {
        console.error(
          `[GraphQL error]: Message: ${err.message}, Path: ${err.path}, Code: ${err.extensions?.code}`
        );
        window.dispatchEvent(
          new CustomEvent(GRAPHQL_ERROR_EVENT, {
            detail: {
              message: err.message,
              code: err.extensions?.code || 'UNKNOWN',
              path: err.path,
              operationName: operation?.operationName,
            },
          })
        );
      });
    }

    // -- Network errors ------------------------------------------------
    if (networkError) {
      console.error(`[Network error]: ${networkError.message}`, networkError);

      // Rejected at the HTTP layer (401/403) → same session recovery path.
      if (isUnauthenticatedNetwork(networkError)) {
        return recoverSession(operation, forward);
      }

      window.dispatchEvent(
        new CustomEvent(NETWORK_ERROR_EVENT, {
          detail: {
            message: networkError.message,
            statusCode: getStatus(networkError),
            operationName: operation?.operationName,
          },
        })
      );
    }

    return undefined;
  }
);

// =====================================================================
// 6. GLOBAL SUBSCRIPTION HELPERS (used by UI, e.g. ApiErrorListener)
// =====================================================================
function listen(event, callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = (e) => callback(e.detail);
  window.addEventListener(event, handler);
  return () => window.removeEventListener(event, handler);
}

/** Subscribe to every non-auth GraphQL error app-wide. Returns unsubscribe. */
export const subscribeToGraphQLErrors = (callback) =>
  listen(GRAPHQL_ERROR_EVENT, callback);

/** Subscribe to every network/server error app-wide. Returns unsubscribe. */
export const subscribeToNetworkErrors = (callback) =>
  listen(NETWORK_ERROR_EVENT, callback);

/** Fires when the session was force-cleared (refresh failed / WS 4401). */
export const subscribeToSessionExpired = (callback) =>
  listen(SESSION_EXPIRED_EVENT, callback);
