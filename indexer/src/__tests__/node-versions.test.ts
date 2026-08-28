/**
 * Issue #497 – supported Node.js version documentation stays in sync with CI.
 */

import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function extractMarker(content: string, name: string): string {
  const match = content.match(new RegExp(`<!-- ${name}: (\\d+) -->`));
  if (!match) {
    throw new Error(`Missing marker <!-- ${name}: N --> in docs/node-versions.md`);
  }
  return match[1]!;
}

describe('supported Node.js versions (issue #497)', () => {
  const doc = readRepoFile('docs/node-versions.md');
  const packageJson = JSON.parse(readRepoFile('package.json'));
  const ciWorkflow = readRepoFile('.github/workflows/ci.yml');
  const nvmrc = readRepoFile('.nvmrc').trim();

  it('documents minimum, recommended, and CI Node versions', () => {
    expect(extractMarker(doc, 'node-min-version')).toBe('18');
    expect(extractMarker(doc, 'node-recommended-version')).toBe('20');
    expect(extractMarker(doc, 'node-ci-version')).toBe('20');
    expect(extractMarker(doc, 'pnpm-min-version')).toBe('9');
  });

  it('matches root package.json engines', () => {
    expect(packageJson.engines?.node).toBe('>=18');
    expect(packageJson.engines?.pnpm).toBe('>=9');
  });

  it('matches CI workflow node-version', () => {
    expect(ciWorkflow).toMatch(/node-version:\s*['"]20['"]/);
  });

  it('matches .nvmrc recommended version', () => {
    expect(nvmrc).toBe('20');
    expect(extractMarker(doc, 'node-recommended-version')).toBe(nvmrc);
  });
});
