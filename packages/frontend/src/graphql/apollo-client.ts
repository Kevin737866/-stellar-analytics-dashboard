import { ApolloClient, InMemoryCache, createHttpLink, split } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';

const httpLink = createHttpLink({
  uri: '/graphql',
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: 'ws://localhost:4000/graphql',
    connectionParams: {
      // Add any authentication headers here if needed
    },
  })
);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
  },
  wsLink,
  httpLink
);

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          ledgers: {
            merge(existing = { edges: [], pageInfo: {}, totalCount: 0 }, incoming) {
              return {
                ...incoming,
                edges: [...(existing?.edges ?? []), ...incoming.edges],
              };
            },
          },
          transactions: {
            merge(existing = { edges: [], pageInfo: {}, totalCount: 0 }, incoming) {
              return {
                ...incoming,
                edges: [...(existing?.edges ?? []), ...incoming.edges],
              };
            },
          },
          operations: {
            merge(existing = { edges: [], pageInfo: {}, totalCount: 0 }, incoming) {
              return {
                ...incoming,
                edges: [...(existing?.edges ?? []), ...incoming.edges],
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
