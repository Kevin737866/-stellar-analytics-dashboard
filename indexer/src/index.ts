import "dotenv/config";
import { Pool } from "pg";
import { pollLatestLedger } from "./ingester.js";
import { 
  normalizeLedger, 
  normalizeTransactions, 
  normalizeOperations, 
  normalizePayments 
} from "./transformer.js";
import { writeIngestedData } from "./loader.js";
import { broadcastRealtimeUpdate } from "./websocket.js";
import { STELLAR_NETWORKS, type StellarNetwork } from "@stellar-analytics/shared";

const network = (process.env.STELLAR_NETWORK ?? "testnet") as StellarNetwork;
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

async function runCycle(): Promise<void> {
  try {
    console.log(`[indexer] polling Horizon for ${String(network)}...`);
    const ingested = await pollLatestLedger(network);
    
    // Normalize data
    const normalizedData = {
      ledger: normalizeLedger(ingested),
      transactions: normalizeTransactions(ingested),
      operations: normalizeOperations(ingested),
      payments: normalizePayments(ingested),
    };

    // Load to DB
    await writeIngestedData(pool, normalizedData);
    
    // Broadcast update
    broadcastRealtimeUpdate({ 
      network, 
      ledger: normalizedData.ledger.sequence, 
      txCount: normalizedData.transactions.length,
      at: new Date().toISOString() 
    });
    
    console.log(`[indexer] successfully processed ledger ${normalizedData.ledger.sequence}`);
  } catch (error) {
    console.error("[indexer] cycle error:", error);
  }
}

import http from "http";

async function main(): Promise<void> {
  console.log(`[indexer] starting on ${String(network)}`);
  
  // Health Check Server
  http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", network, time: new Date().toISOString() }));
    } else {
      res.writeHead(404);
      res.end();
    }
  }).listen(3001, () => {
    console.log("[indexer] health check operational on port 3001");
  });

  // Initial run
  await runCycle();
  
  // Polling loop (every 5 seconds)
  setInterval(() => {
    runCycle().catch(console.error);
  }, 5000);
}

main().catch((error) => {
  console.error("[indexer] fatal error:", error);
  process.exit(1);
});
