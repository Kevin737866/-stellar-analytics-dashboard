/**
 * Issue #491 – Architecture package path documentation
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../..");
const DOC_PATH = resolve(REPO_ROOT, "docs/architecture.md");

const CANONICAL_PATHS = [
  "indexer/src",
  "packages/api/src",
  "frontend/src",
  "shared/src",
  "packages/e2e",
  "packages/indexer/migrations",
];

describe("Issue #491 – architecture package paths", () => {
  it("docs/architecture.md exists", () => {
    expect(readFileSync(DOC_PATH, "utf8")).toContain("# Architecture Overview");
  });

  it("documents canonical paths that exist on disk", () => {
    for (const relativePath of CANONICAL_PATHS) {
      expect(existsSync(resolve(REPO_ROOT, relativePath))).toBe(true);
    }
  });

  it("README references workspace indexer path", () => {
    const readme = readFileSync(resolve(REPO_ROOT, "README.md"), "utf8");
    expect(readme).toContain("indexer/");
    expect(readme).not.toMatch(/packages\/indexer\/src/);
  });

  it("incident runbook uses canonical indexer path", () => {
    const runbook = readFileSync(
      resolve(REPO_ROOT, "docs/incident-response-runbook.md"),
      "utf8"
    );
    expect(runbook).toContain("indexer/");
    expect(runbook).not.toContain("packages/indexer — Port 3001");
  });
});
