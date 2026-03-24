export type StellarNetwork = "mainnet" | "testnet";

export interface StellarNetworkConfig {
  network: StellarNetwork;
  horizonUrl: string;
  networkPassphrase: string;
}
