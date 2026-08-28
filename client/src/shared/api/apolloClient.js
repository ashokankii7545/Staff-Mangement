import { ApolloClient, InMemoryCache, ApolloLink, split, Observable } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { RetryLink } from '@apollo/client/link/retry';
import { onError } from '@apollo/client/link/error';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import createUploadLink from 'apollo-upload-client/createUploadLink.mjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger';

// Fallback to relative path if no env is set, proxy will handle it
const HTTP_URI = import.meta.env.GRAPHQL_HTTP_URI || 'http://localhost:8080/graphql';
const WS_URI = import.meta.env.GRAPHQL_WS_URI || 'ws://localhost:8080/graphql';

// 1. DEPENDENCY INJECTION (Local Storage mapping)
export const authProvider = {
  getToken: () => localStorage.getItem('token'),
  /**
   * Silent session renewal: exchange the stored refresh token for a new
   * access + refresh pair. Uses raw fetch (NOT the Apollo client) so the
   * refresh request itself can never re-enter this error-link queue.
   */
  refreshToken: async () => {
    const current = localStorage.getItem('refreshToken');
    if (!current) throw new Error('No refresh token – full login required.');

    const res = await fetch(HTTP_URI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation($rt: String!) { refreshToken(refreshToken: $rt) { token refreshToken } }`,
        variables: { rt: current },
      }),
    });
    const json = await res.json();
    const payload = json?.data?.refreshToken;
    if (!payload?.token) {
      throw new Error(json?.errors?.[0]?.message || 'Refresh token rejected.');
    }
    localStorage.setItem('token', payload.token);
    if (payload.refreshToken) localStorage.setItem('refreshToken', payload.refreshToken);
    return payload.token;
  },
  handleStepUpAuth: (acrValues) => console.warn('Step up auth requested:', acrValues),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },
  isCallbackInFlight: () => false,
};

// 2. STATE & QUEUE MANAGEMENT
let isRefreshing = false;
let pendingQueue = [];

const processQueue = (token, error = null) => {
  pendingQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  pendingQueue = [];
};

// 3. SMART CIRCUIT BREAKER (Exponential Backoff)
let authDead = false;
let consecutiveAuthFailures = 0;
const MAX_FAILURES = 3;

// A. TRACING LINK (For Datadog / OpenTelemetry)
const tracingLink = setContext((_, { headers }) => ({
  headers: {
    ...headers,
    'x-correlation-id': uuidv4(), // Every request gets a unique trace ID
    'x-client-version': '1.0.0',
  },
}));

// B. APQ LINK REMOVED ON PURPOSE.
// Automatic Persisted Queries cause PERSISTED_QUERY_NOT_FOUND errors after
// every dev server restart (the hash cache lives in server memory), which the
// UI surfaced as fake network-error banners. Plain POSTed queries are reliable
// and cost nothing extra locally.

// C. AUTH LINK
const authLink = setContext((_, { headers }) => {
  const token = authProvider.getToken();
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

// D. THE MEGA ERROR & QUEUE LINK
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  
  if (authDead) {
    return new Observable((observer) => {
      logger.error('Circuit breaker tripped');
      observer.error(new Error('AUTH_DEAD: Circuit breaker tripped.'));
    });
  }

  if (graphQLErrors) {
    graphQLErrors.forEach(err => logger.error('GraphQL Error', err));
    for (const err of graphQLErrors) {
      
      const acrValues = err.extensions?.acr_values;
      if (acrValues) {
        logger.info('Step up auth requested', { acrValues });
        authProvider.handleStepUpAuth(acrValues);
        return; // Pause execution
      }

      if (err.extensions?.code === 'UNAUTHENTICATED' || err.message.includes('Not authenticated')) {
        // Bypass for auth operations: wrong password naturally returns UNAUTHENTICATED, we should not log them out/refresh.
        const opName = operation.operationName;
        if (opName === 'Login' || opName === 'GoogleLogin' || opName === 'Signup' || opName === 'RequestPasswordReset') {
          return; // Let the component handle the error
        }

        // CRITICAL FIX: If we don't even have a token, we can't refresh it.
        // And we shouldn't force a navigation to /login if they are already trying to log in!
        if (!authProvider.getToken()) {
          return;
        }

        if (authProvider.isCallbackInFlight()) return; // Don't interrupt OAuth flow

        consecutiveAuthFailures++;
        if (consecutiveAuthFailures >= MAX_FAILURES) {
          authDead = true;
          authProvider.logout();
          return new Observable((obs) => obs.error(new Error('AUTH_PERMANENTLY_DEAD')));
        }

        if (!isRefreshing) {
          isRefreshing = true;
          
          return new Observable((observer) => {
            authProvider.refreshToken()
              .then((newToken) => {
                consecutiveAuthFailures = 0; // Reset breaker
                isRefreshing = false;
                processQueue(newToken);
                
                const oldHeaders = operation.getContext().headers;
                operation.setContext({ headers: { ...oldHeaders, authorization: `Bearer ${newToken}` } });
                forward(operation).subscribe(observer);
              })
              .catch((error) => {
                isRefreshing = false;
                processQueue(null, error);
                authDead = true;
                authProvider.logout();
                observer.error(error);
              });
          });
        } else {
          return new Observable((observer) => {
            pendingQueue.push({
              resolve: (token) => {
                const oldHeaders = operation.getContext().headers;
                operation.setContext({ headers: { ...oldHeaders, authorization: `Bearer ${token}` } });
                forward(operation).subscribe(observer);
              },
              reject: (err) => observer.error(err),
            });
          });
        }
      }
    }
  }

  if (networkError) {
    logger.error('Network Error', networkError);
    window.dispatchEvent(new CustomEvent('global-api-error', { detail: networkError }));
  }
});

// E. HTTP / UPLOAD LINK
const uploadLink = createUploadLink({
  uri: HTTP_URI,
  headers: { 'Apollo-Require-Preflight': 'true' },
});

// F. WEBSOCKET LINK
// lazy: connect only when a subscription is actually used.
// connectionParams: authenticate the socket so per-user subscriptions
// (e.g. notificationAdded) can be filtered server-side.
const wsLink = new GraphQLWsLink(createClient({
  url: WS_URI,
  lazy: true,
  connectionParams: () => ({
    authorization: localStorage.getItem('token') || '',
  }),
}));

// 8. RETRY LINK (Network layer reliability)
const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: 3000,
    jitter: true,
  },
  attempts: {
    max: 3,
    retryIf: (error, _operation) => !!error && error.name !== 'ServerError', // Only retry network errors, not GraphQL errors
  },
});

// 9. TIMEOUT LINK
const timeoutLink = new ApolloLink((operation, forward) => {
  const timeout = operation.getContext().timeout || 15000;
  
  return new Observable((observer) => {
    let subscription;

    try {
      subscription = forward(operation).subscribe({
        next: (result) => observer.next(result),
        error: (error) => observer.error(error),
        complete: () => observer.complete(),
      });
    } catch (e) {
      observer.error(e);
    }

    const handle = setTimeout(() => {
      if (subscription) subscription.unsubscribe();
      observer.error(new Error('Request timeout exceeded'));
    }, timeout);

    return () => {
      clearTimeout(handle);
      if (subscription) subscription.unsubscribe();
    };
  });
});

// CHAIN EXECUTION ORDER IS ABSOLUTELY CRITICAL:
// Error(Refresh/Queue) -> Tracing -> Auth -> UploadLink(HTTP)
const httpChain = ApolloLink.from([
  timeoutLink,
  retryLink,
  errorLink,
  tracingLink,
  authLink,
  uploadLink,
]);

// Split HTTP vs Websocket
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpChain
);

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Location: { keyFields: false },
      VPNDetails: { keyFields: false },
    }
  }),
  defaultOptions: {
    watchQuery: { errorPolicy: 'all', fetchPolicy: 'cache-and-network' },
    query: { errorPolicy: 'all', fetchPolicy: 'network-only' },
    mutate: { errorPolicy: 'all' },
  },
});

export default client;





