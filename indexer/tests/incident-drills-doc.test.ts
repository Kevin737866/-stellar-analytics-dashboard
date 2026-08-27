/**
 * Issue #486 – Incident drill evidence documentation
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../..");
const DRILL_LOG = resolve(REPO_ROOT, "docs/operations/incident-drills.md");

describe("Issue #486 – incident drill evidence", () => {
  const content = readFileSync(DRILL_LOG, "utf8");

  it("incident drill log exists", () => {
    expect(content).toContain("# Incident Drill Log");
  });

  it("documents required drill artifacts", () => {
    expect(content).toContain("Required Artifacts");
    expect(content).toContain("checksum");
    expect(content).toContain("Validation query results");
  });

  it("includes at least one completed drill entry", () => {
    expect(content).toContain("Drill Log");
    expect(content).toMatch(/\| \d{4}-\d{2}-\d{2} \|.*\| Pass \|/);
  });

  it("backup runbook links to the drill log", () => {
    const backup = readFileSync(
      resolve(REPO_ROOT, "docs/backup-disaster-recovery.md"),
      "utf8"
    );
    expect(backup).toContain("docs/operations/incident-drills.md");
  });

  it("incident runbook appendix references drill log", () => {
    const runbook = readFileSync(
      resolve(REPO_ROOT, "docs/incident-response-runbook.md"),
      "utf8"
    );
    expect(runbook).toContain("incident-drills.md");
  });
});
