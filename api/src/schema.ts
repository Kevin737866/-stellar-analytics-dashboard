export const typeDefs = /* GraphQL */ `
  type Health {
    status: String!
    timestamp: String!
  }

  type Ledger {
    sequence: Int!
    hash: String!
    txCount: Int!
  }

  type Query {
    health: Health!
    ledgers: [Ledger!]!
  }
`;
