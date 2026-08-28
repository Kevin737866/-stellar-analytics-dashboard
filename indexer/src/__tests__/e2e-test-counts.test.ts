/**
 * Issue #488 – E2E test counts in docs match Playwright spec files.
 */

import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../');
const e2eTestsDir = path.join(repoRoot, 'packages/e2e/tests');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function countPlaywrightTests(specPath: string): number {
  const content = fs.readFileSync(specPath, 'utf8');
  const matches = content.match(/^\s*(test|it)\(/gm);
  return matches ? matches.length : 0;
}

function extractMarker(content: string, name: string): number {
  const match = content.match(new RegExp(`<!-- ${name}: (\\d+) -->`));
  if (!match) {
    throw new Error(`Missing marker <!-- ${name}: N --> in E2E_TESTING_GUIDE.md`);
  }
  return Number(match[1]);
}

describe('E2E test counts (issue #488)', () => {
  const guide = readRepoFile('packages/e2e/E2E_TESTING_GUIDE.md');
  const specFiles = fs
    .readdirSync(e2eTestsDir)
    .filter((file) => file.endsWith('.spec.ts'))
    .sort();

  it('counts tests in every Playwright spec file', () => {
    const perFile: Record<string, number> = {};
    let total = 0;

    for (const file of specFiles) {
      const count = countPlaywrightTests(path.join(e2eTestsDir, file));
      perFile[file] = count;
      total += count;
    }

    expect(specFiles).toHaveLength(extractMarker(guide, 'e2e-suite-count'));
    expect(total).toBe(extractMarker(guide, 'e2e-test-count'));
    expect(total).toBe(68);
    expect(perFile).toMatchObject({
      'auth.spec.ts': 7,
      'dashboard.spec.ts': 9,
      'data-visualization.spec.ts': 9,
      'search.spec.ts': 4,
      'details.spec.ts': 6,
      'responsive.spec.ts': 7,
      'performance.spec.ts': 6,
      'visual-regression.spec.ts': 20,
    });
  });

  it('documents the total in README.md', () => {
    const readme = readRepoFile('packages/e2e/README.md');
    expect(readme).toContain('68 Playwright tests');
  });
});
