import { pollLatestLedger } from "../src/ingester.js";
import { STELLAR_NETWORKS } from "@stellar-analytics/shared";

describe("Stellar Ingester", () => {
  it("should poll latest ledger on testnet", async () => {
    const data = await pollLatestLedger("testnet");
    
    expect(data.ledger).toBeDefined();
    expect(data.ledger.sequence).toBeGreaterThan(0);
    expect(data.transactions).toBeInstanceOf(Array);
    expect(data.operations).toBeInstanceOf(Array);
  });
});
