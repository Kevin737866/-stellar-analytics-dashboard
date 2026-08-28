/**
 * Issue #492 – Runbook verification dates
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../..");

const RUNBOOKS = [
  "docs/incident-response-runbook.md",
  "docs/backup-disaster-recovery.md",
  "docs/DEPLOYMENT_ROLLBACK.md",
  "docs/startup-troubleshooting.md",
];

describe("Issue #492 – runbook verification dates", () => {
  for (const relativePath of RUNBOOKS) {
    describe(relativePath, () => {
      const content = readFileSync(resolve(REPO_ROOT, relativePath), "utf8");

      it("includes Last Verified date", () => {
        expect(content).toMatch(/\*\*Last Verified:\*\* \d{4}-\d{2}-\d{2}/);
      });

      it("includes Next Review date", () => {
        expect(content).toMatch(/\*\*Next Review:\*\* \d{4}-\d{2}-\d{2}/);
      });
    });
  }

  it("incident runbook includes a verification log table", () => {
    const runbook = readFileSync(
      resolve(REPO_ROOT, "docs/incident-response-runbook.md"),
      "utf8"
    );
    expect(runbook).toContain("Verification Log");
    expect(runbook).toContain("Procedure verified");
  });

  it("backup runbook includes a restoration testing log", () => {
    const doc = readFileSync(
      resolve(REPO_ROOT, "docs/backup-disaster-recovery.md"),
      "utf8"
    );
    expect(doc).toContain("Restoration Testing Log");
  });
});
