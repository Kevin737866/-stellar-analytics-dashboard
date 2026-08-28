import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  split,
  from,
} from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { onError } from '@apollo/client/link/error';
import { createClient, type Client } from 'graphql-ws';

// ── WebSocket URL ─────────────────────────────────────────────────────────────
// In dev, Vite proxies /graphql HTTP but WS needs to go directly to the API.
// In production (same origin), derive from window.location.
function getWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:4000/graphql';
  
  const envUrl = import.meta.env.VITE_GRAPHQL_URL;
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.replace(/^http/, 'ws');
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.DEV ? 'localhost:4000' : window.location.host;
  return `${protocol}//${host}/graphql`;
}

// ── Connection state (observable outside React) ───────────────────────────────
export type WsStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

type StatusListener = (status: WsStatus) => void;
const statusListeners = new Set<StatusListener>();
let currentStatus: WsStatus = 'connecting';

export function subscribeToWsStatus(fn: StatusListener): () => void {
  statusListeners.add(fn);
  fn(currentStatus); // emit current value immediately
  return () => statusListeners.delete(fn);
}

function setStatus(s: WsStatus) {
  if (s === currentStatus) return;
  currentStatus = s;
  statusListeners.forEach((fn) => fn(s));
}

// ── graphql-ws client with reconnect ─────────────────────────────────────────
let reconnectAttempts = 0;

export const wsClient: Client = createClient({
  url: getWsUrl(),
  // Keep-alive ping every 30 s
  keepAlive: 30_000,
  // Reconnect with exponential backoff, max 30 s
  retryAttempts: Infinity,
  retryWait: async (attempt) => {
    const delay = Math.min(1000 * 2 ** attempt, 30_000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  },
  shouldRetry: () => true,
  on: {
    connecting: () => {
      reconnectAttempts > 0 ? setStatus('reconnecting') : setStatus('connecting');
    },
    connected: () => {
      reconnectAttempts = 0;
      setStatus('connected');
    },
    closed: () => {
      setStatus('disconnected');
    },
    error: (err) => {
      reconnectAttempts++;
      setStatus('error');
    },
  },
});

// ── Links ─────────────────────────────────────────────────────────────────────
const httpUri = import.meta.env.VITE_GRAPHQL_URL || '/graphql';
const httpLink = createHttpLink({ uri: httpUri });

const wsLink = new GraphQLWsLink(wsClient);

const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      // Issue #340 – prefer the classified userMessage in the log so console
      // output is as readable as what the UI shows. Fall back to raw message.
      const displayMessage =
        (extensions?.userMessage as string | undefined) ?? message;
      const code = (extensions?.code as string | undefined) ?? 'UNKNOWN';

      console.warn(
        `[GraphQL error] op=${operation.operationName} code=${code} path=${String(path)} msg=${displayMessage}`,
        locations
      );
    });
  }
  if (networkError) {
    console.warn(`[Network error] op=${operation.operationName}:`, networkError);
  }
});

// Route subscriptions over WS, everything else over HTTP
const splitLink = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return def.kind === 'OperationDefinition' && def.operation === 'subscription';
  },
  wsLink,
  from([errorLink, httpLink])
);

// ── Cache ─────────────────────────────────────────────────────────────────────
export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          ledgers: {
            // Prepend new ledgers (highest sequence first)
            keyArgs: ['timeRange', 'pagination'],
            merge(
              existing = { edges: [], pageInfo: {}, totalCount: 0 },
              incoming: any
            ) {
              // Deduplicate by cursor
              const existingCursors = new Set(
                (existing.edges ?? []).map((e: any) => e.cursor)
              );
              const newEdges = (incoming.edges ?? []).filter(
                (e: any) => !existingCursors.has(e.cursor)
              );
              return {
                ...incoming,
                edges: [...newEdges, ...(existing.edges ?? [])],
              };
            },
          },
          transactions: {
            keyArgs: ['filter', 'timeRange', 'pagination'],
            merge(
              existing = { edges: [], pageInfo: {}, totalCount: 0 },
              incoming: any
            ) {
              const existingCursors = new Set(
                (existing.edges ?? []).map((e: any) => e.cursor)
              );
              const newEdges = (incoming.edges ?? []).filter(
                (e: any) => !existingCursors.has(e.cursor)
              );
              return {
                ...incoming,
                edges: [...newEdges, ...(existing.edges ?? [])],
              };
            },
          },
          operations: {
            keyArgs: ['type', 'filter', 'pagination'],
            merge(
              existing = { edges: [], pageInfo: {}, totalCount: 0 },
              incoming: any
            ) {
              const existingCursors = new Set(
                (existing.edges ?? []).map((e: any) => e.cursor)
              );
              const newEdges = (incoming.edges ?? []).filter(
                (e: any) => !existingCursors.has(e.cursor)
              );
              return {
                ...incoming,
                edges: [...newEdges, ...(existing.edges ?? [])],
              };
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
      notifyOnNetworkStatusChange: true,
    },
    query: {
      errorPolicy: 'all',
    },
  },
});
