/**
 * Issue #496 – contributor issue taxonomy documentation.
 */

import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function extractList(content: string, marker: string): string[] {
  const match = content.match(new RegExp(`<!-- ${marker}: ([^>]+) -->`));
  if (!match) {
    throw new Error(`Missing marker <!-- ${marker}: ... --> in contributor-issue-taxonomy.md`);
  }
  return match[1]!.split(',').map((item) => item.trim());
}

describe('contributor issue taxonomy (issue #496)', () => {
  const taxonomyDoc = readRepoFile('docs/contributor-issue-taxonomy.md');
  const contributingDoc = readRepoFile('CONTRIBUTING.md');
  const featureTemplate = readRepoFile('.github/ISSUE_TEMPLATE/feature_request.yml');

  it('documents required workflow and area labels', () => {
    const labels = extractList(taxonomyDoc, 'taxonomy-labels');
    expect(labels).toEqual(
      expect.arrayContaining([
        'needs-triage',
        'priority: critical',
        'priority: high',
        'wontfix',
      ]),
    );

    const areas = extractList(taxonomyDoc, 'taxonomy-areas');
    expect(areas).toEqual(
      expect.arrayContaining(['frontend', 'api', 'indexer', 'shared', 'docs']),
    );
  });

  it('lists every Feature Request template area option', () => {
    const areas = extractList(taxonomyDoc, 'taxonomy-areas');
    for (const area of areas) {
      expect(featureTemplate).toContain(`- ${area}`);
    }
  });

  it('is linked from CONTRIBUTING.md', () => {
    expect(contributingDoc).toContain('docs/contributor-issue-taxonomy.md');
  });
});
