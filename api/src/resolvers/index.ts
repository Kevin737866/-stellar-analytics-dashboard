import { nowIso } from "@stellar-analytics/shared";

export const resolvers = {
  health: () => ({
    status: "ok",
    timestamp: nowIso()
  }),
  ledgers: () => [
    {
      sequence: 1,
      hash: "stub-ledger-hash",
      txCount: 0
    }
  ]
};
