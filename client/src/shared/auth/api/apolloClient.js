import { ApolloClient, InMemoryCache, split, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import createUploadLink from 'apollo-upload-client/createUploadLink.mjs';
import {
  retryLink,
  errorLink,
  setActiveWsClient,
  performSecureLogout,
} from './errorHandler';

const HTTP_URI = import.meta.env.VITE_GRAPHQL_HTTP_URI || 'http://localhost:8080/graphql';
const WS_URI = import.meta.env.VITE_GRAPHQL_WS_URI || 'ws://localhost:8080/graphql';

const uploadLink = createUploadLink({
  uri: HTTP_URI,
  headers: { 'Apollo-Require-Preflight': 'true' },
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

// WebSocket: lazy connect + DYNAMIC token (read on every connect/reconnect)
const wsClient = createClient({
  url: WS_URI,
  lazy: true, // don't open a socket until a subscription needs it
  retryAttempts: 10,
  shouldRetry: () => true,
  connectionParams: () => {
    const token = localStorage.getItem('token');
    return token ? { authorization: `Bearer ${token}` } : {};
  },
  on: {
    closed: (socket, event) => {
      // Server rejected the socket as unauthorized -> session is dead.
      const code = event?.code ?? socket?.closeCode ?? socket?.code;
      if ((code === 4401 || code === 4403) && localStorage.getItem('token')) {
        performSecureLogout();
      }
    },
  },
});
// Let errorHandler refresh/dispose the socket without a circular import.
setActiveWsClient(wsClient);

const wsLink = new GraphQLWsLink(wsClient);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  uploadLink
);

// Chain order matters: retry outermost, then errors, then auth, then transport.
const client = new ApolloClient({
  link: from([retryLink, errorLink, authLink, splitLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
    query: { fetchPolicy: 'network-only' },
  },
});

export default client;

