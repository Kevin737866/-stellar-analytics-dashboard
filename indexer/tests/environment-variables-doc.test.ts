/**
 * Issue #490 – Environment variable reference documentation
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../..");
const DOC_PATH = resolve(REPO_ROOT, "docs/environment-variables.md");

function readDoc(): string {
  return readFileSync(DOC_PATH, "utf8");
}

function parseEnvExample(relativePath: string): string[] {
  const content = readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
    .map((line) => line.split("=")[0] as string);
}

describe("Issue #490 – environment variable reference", () => {
  it("docs/environment-variables.md exists", () => {
    expect(readDoc()).toContain("# Environment Variables Reference");
  });

  it("documents every variable from indexer/.env.example", () => {
    const doc = readDoc();
    const vars = parseEnvExample("indexer/.env.example");
    for (const name of vars) {
      expect(doc).toContain(name);
    }
  });

  it("documents every variable from packages/api/.env.example", () => {
    const doc = readDoc();
    const vars = parseEnvExample("packages/api/.env.example");
    for (const name of vars) {
      expect(doc).toContain(name);
    }
  });

  it("documents frontend VITE_ variables", () => {
    const doc = readDoc();
    expect(doc).toContain("VITE_GRAPHQL_URL");
    expect(doc).toContain("VITE_STELLAR_NETWORK");
  });
});
