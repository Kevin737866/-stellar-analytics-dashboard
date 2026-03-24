import type { StellarNetworkConfig } from "../types/stellar.js";

export const STELLAR_NETWORKS: Record<"mainnet" | "testnet", StellarNetworkConfig> = {
  mainnet: {
    network: "mainnet",
    horizonUrl: "https://horizon.stellar.org",
    networkPassphrase: "Public Global Stellar Network ; September 2015"
  },
  testnet: {
    network: "testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015"
  }
};
