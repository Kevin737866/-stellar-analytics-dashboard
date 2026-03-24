import { useMemo } from "react";

export function useDashboardData() {
  return useMemo(
    () => ({
      network: "mainnet",
      totalLedgers: 1,
      totalTransactions: 0
    }),
    []
  );
}
