/**
 * Issue #454 – visual baseline retention documentation and inventory check.
 *
 * The retention policy lives in packages/e2e/VISUAL_BASELINES.md. These tests
 * keep it honest:
 *   - the retention table must cover committed baselines and CI artifacts
 *   - the documented retention windows must match the visual-regression and
 *     nightly workflows (so an artifact expiry change cannot silently drift)
 *   - check:baselines must flag orphaned baselines and pass a clean tree
 */

import { spawnSync, type SpawnSyncReturns } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../');
const baselineDocPath = 'packages/e2e/VISUAL_BASELINES.md';
const checkScript = path.join(repoRoot, 'packages/e2e/scripts/check-visual-baselines.mjs');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function extractRetentionMarker(content: string): Record<string, number> {
  const match = content.match(/<!-- baseline-retention-days: ([^>]+) -->/);
  if (!match) {
    throw new Error(
      `Missing marker <!-- baseline-retention-days: artifact=<days>, ... --> in ${baselineDocPath}`
    );
  }

  const markerValue = match[1];
  if (!markerValue) {
    throw new Error(`Empty retention marker in ${baselineDocPath}`);
  }

  const retention: Record<string, number> = {};
  for (const pair of markerValue.split(',')) {
    const [artifact, days] = pair.split('=').map((part) => part.trim());
    if (!artifact || !days || Number.isNaN(Number(days))) {
      throw new Error(`Invalid retention entry "${pair}" in ${baselineDocPath}`);
    }
    retention[artifact] = Number(days);
  }
  return retention;
}

/** Artifact name → retention-days for each upload-artifact step in a workflow. */
function extractArtifactRetention(workflow: string): Record<string, number> {
  const retention: Record<string, number> = {};

  // Split into step-sized chunks so an artifact name is paired with the
  // retention-days value inside the same upload step.
  for (const chunk of workflow.split(/\n(?=\s*-\s+name:)/)) {
    const artifact = chunk.match(/^\s*name:\s*([a-z0-9][a-z0-9-]*)\s*$/m);
    const days = chunk.match(/^\s*retention-days:\s*(\d+)\s*$/m);
    if (artifact?.[1] && days?.[1]) {
      retention[artifact[1]] = Number(days[1]);
    }
  }

  return retention;
}
function runBaselineCheck(snapshotsDir: string, specPath: string): SpawnSyncReturns<string> {
  return spawnSync(
    process.execPath,
    [checkScript, '--json', '--spec', specPath, '--snapshots', snapshotsDir],
    { cwd: repoRoot, encoding: 'utf8' }
  );
}

describe('visual baseline retention (issue #454)', () => {
  const doc = readRepoFile(baselineDocPath);

  it('documents where baselines live and how long they are kept', () => {
    // Committed baselines live in git indefinitely; CI artifacts expire.
    expect(doc).toMatch(/committed baselines/i);
    expect(doc).toMatch(/indefinite/i);
    expect(doc).toContain('snapshotPathTemplate');
    expect(doc).toContain('tests/__snapshots__');

    // The policy must tell contributors how to update and prune baselines.
    expect(doc).toContain('test:visual:update');
    expect(doc).toContain('check:baselines');
  });

  it('keeps documented retention aligned with the visual workflows', () => {
    const documented = extractRetentionMarker(doc);
    const actual = {
      ...extractArtifactRetention(readRepoFile('.github/workflows/visual-regression.yml')),
      ...extractArtifactRetention(readRepoFile('.github/workflows/visual-regression-nightly.yml')),
    };

    expect(Object.keys(documented).sort()).toEqual([
      'visual-regression-diffs',
      'visual-regression-report',
      'visual-regression-results',
      'visual-regression-screenshots',
    ]);

    for (const [artifact, days] of Object.entries(documented)) {
      expect(actual[artifact]).toBe(days);
    }
  });

  it('flags orphaned baselines and accepts referenced ones', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-baselines-'));
    const specPath = path.join(tmpRoot, 'visual-regression.spec.ts');
    const snapshotsDir = path.join(tmpRoot, '__snapshots__');
    const committedDir = path.join(snapshotsDir, 'visual-regression.spec.ts', 'visual-regression');

    try {
      fs.mkdirSync(committedDir, { recursive: true });
      fs.writeFileSync(
        specPath,
        "test('dashboard', async ({ page }) => {\n" +
          "  await expect(page).toHaveScreenshot('dashboard-light.png');\n" +
          '});\n'
      );
      fs.writeFileSync(path.join(committedDir, 'dashboard-light.png'), '');

      const clean = runBaselineCheck(snapshotsDir, specPath);
      expect(clean.status).toBe(0);
      const cleanInventory = JSON.parse(clean.stdout);
      expect(cleanInventory.orphaned).toEqual([]);
      expect(cleanInventory.missing).toEqual([]);

      fs.writeFileSync(path.join(committedDir, 'removed-test.png'), '');

      const withOrphan = runBaselineCheck(snapshotsDir, specPath);
      expect(withOrphan.status).toBe(1);
      const orphanInventory = JSON.parse(withOrphan.stdout);
      expect(orphanInventory.orphaned).toHaveLength(1);
      expect(orphanInventory.orphaned[0]).toContain('removed-test.png');
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
