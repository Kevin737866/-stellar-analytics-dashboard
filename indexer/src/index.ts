import "dotenv/config";
import { Pool } from "pg";
import { pollHorizon } from "./ingester.js";
import { normalizeLedgers } from "./transformer.js";
import { writeLedgers } from "./loader.js";
import { broadcastRealtimeUpdate } from "./websocket.js";
import type { StellarNetwork } from "@stellar-analytics/shared";

const network = (process.env.STELLAR_NETWORK ?? "mainnet") as StellarNetwork;
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

async function runOnce(): Promise<void> {
  const ingested = await pollHorizon(network);
  const normalized = normalizeLedgers(ingested);
  await writeLedgers(pool, normalized);
  broadcastRealtimeUpdate({ network, count: normalized.length, at: new Date().toISOString() });
}

async function main(): Promise<void> {
  await runOnce();
  console.log(`[indexer] running on ${network}`);
  setInterval(() => {
    runOnce().catch((error) => {
      console.error("[indexer] cycle error", error);
    });
  }, 15_000);
}

main().catch((error) => {
  console.error("[indexer] fatal", error);
  process.exit(1);
});
