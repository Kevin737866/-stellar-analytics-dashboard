#!/usr/bin/env node
/**
 * Visual baseline inventory check (issue #454)
 *
 * Ensures the committed Playwright snapshots stay in sync with the tests that
 * reference them.  Baselines have no expiry, so the only way they stay
 * trustworthy is by deleting them when the owning test disappears.
 *
 * Behaviour:
 *   - reads every `toHaveScreenshot('<name>.png')` call in the visual spec
 *   - walks the snapshot directory for committed `*.png` baselines
 *   - reports baselines that no test references (orphaned) and tests that have
 *     no baseline yet (missing)
 *
 * Exit codes:
 *   0  no orphaned baselines (missing baselines are warnings only, because a
 *      clean checkout has none until they are generated and committed)
 *   1  orphaned baselines found — delete them in the PR that removed the test
 *
 * Usage:
 *   node scripts/check-visual-baselines.mjs [--json] [--spec <file>]
 *                                           [--snapshots <dir>]
 *
 * The --spec/--snapshots overrides exist so the check itself can be tested
 * against fixture directories (see indexer/src/__tests__).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_SPEC = path.join(packageRoot, 'tests', 'visual-regression.spec.ts');
const DEFAULT_SNAPSHOTS = path.join(packageRoot, 'tests', '__snapshots__');

function parseArgs(argv) {
  const options = { json: false, spec: DEFAULT_SPEC, snapshots: DEFAULT_SNAPSHOTS };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--spec' && argv[i + 1]) {
      options.spec = path.resolve(argv[i + 1]);
      i += 1;
    } else if (arg === '--snapshots' && argv[i + 1]) {
      options.snapshots = path.resolve(argv[i + 1]);
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

/** Names passed to `toHaveScreenshot()` in the spec, e.g. `dashboard-light.png`. */
export function collectReferencedBaselines(specPath) {
  const content = fs.readFileSync(specPath, 'utf8');
  const names = new Set();
  const pattern = /toHaveScreenshot\(\s*['"`]([^'"`]+?\.png)['"`]/g;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    names.add(match[1]);
  }

  return [...names].sort();
}

/** Every committed PNG below the snapshot directory, relative to `root`. */
export function collectCommittedBaselines(root) {
  if (!fs.existsSync(root)) return [];

  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.png')) {
        found.push(path.relative(root, fullPath).split(path.sep).join('/'));
      }
    }
  };

  walk(root);
  return found.sort();
}

/**
 * Compare referenced names against committed baselines.
 *
 * A baseline matches when its file name equals a referenced screenshot name —
 * the snapshot path template inserts the project directory but never changes
 * the file name.
 */
export function buildInventory(referenced, committed) {
  const referencedNames = new Set(referenced);
  const committedNames = new Set(committed.map((file) => path.posix.basename(file)));

  return {
    referenced,
    committed,
    orphaned: committed.filter((file) => !referencedNames.has(path.posix.basename(file))),
    missing: referenced.filter((name) => !committedNames.has(name)),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(
      'Usage: node scripts/check-visual-baselines.mjs [--json] [--spec <file>] [--snapshots <dir>]'
    );
    return 0;
  }

  if (!fs.existsSync(options.spec)) {
    console.error(`[baselines] Spec not found: ${options.spec}`);
    return 1;
  }

  const inventory = buildInventory(
    collectReferencedBaselines(options.spec),
    collectCommittedBaselines(options.snapshots)
  );

  if (options.json) {
    console.log(JSON.stringify(inventory, null, 2));
  } else {
    console.log('[baselines] Visual baseline inventory');
    console.log(`  referenced screenshots : ${inventory.referenced.length}`);
    console.log(`  committed baselines    : ${inventory.committed.length}`);

    if (inventory.orphaned.length > 0) {
      console.log('\n  Orphaned baselines (no matching toHaveScreenshot()):');
      for (const file of inventory.orphaned) console.log(`    - ${file}`);
    } else {
      console.log('  orphaned baselines     : 0');
    }

    if (inventory.missing.length > 0) {
      console.log(
        `\n  ${inventory.missing.length} screenshot(s) have no committed baseline yet` +
          ' — generate and commit them with `pnpm test:visual:update`.'
      );
    }

    console.log('\n  Retention policy: packages/e2e/VISUAL_BASELINES.md');
  }

  return inventory.orphaned.length > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
