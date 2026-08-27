import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../../');

describe('GraphQL Controls Documentation Audit (#489)', () => {
  const docPath = path.join(REPO_ROOT, 'docs/graphql-query-limits.md');
  const apiExamplesPath = path.join(REPO_ROOT, 'docs/api-examples.md');

  it('verifies that docs/graphql-query-limits.md exists', () => {
    assert.strictEqual(fs.existsSync(docPath), true, 'graphql-query-limits.md must exist');
  });

  it('contains the Control Enforcement Matrix with status classifications', () => {
    const content = fs.readFileSync(docPath, 'utf8');
    assert.match(content, /## Control Enforcement Matrix/, 'Must have matrix header');
    assert.match(content, /IP Rate Limiting.*Enforced/, 'Rate limiting must be marked Enforced');
    assert.match(content, /Query Depth Limiting.*Aspirational/, 'Depth limiting must be marked Aspirational');
    assert.match(content, /Query Complexity Score.*Aspirational/, 'Complexity score must be marked Aspirational');
    assert.match(content, /X-Query-Complexity.*Aspirational/, 'X-Query-Complexity must be marked Aspirational');
  });

  it('marks Depth Limiting and Complexity sections with Aspirational status banners', () => {
    const content = fs.readFileSync(docPath, 'utf8');
    assert.match(content, /Status:\s*Aspirational\s*\/\s*In-Progress/, 'Depth limiting must have aspirational status banner');
    assert.match(content, /api\/src\/index\.ts/, 'Must accurately state lack of wiring in active server');
  });

  it('maintains consistent terminology with docs/api-examples.md §5.2', () => {
    const docContent = fs.readFileSync(docPath, 'utf8');
    const apiExamplesContent = fs.readFileSync(apiExamplesPath, 'utf8');

    assert.match(docContent, /api-examples\.md/, 'graphql-query-limits.md must cross-link to api-examples.md');
    assert.match(apiExamplesContent, /graphql-query-limits\.md.*is aspirational/, 'api-examples.md must cite aspirational status');
  });

  it('includes an actionable Operational Promotion Checklist', () => {
    const content = fs.readFileSync(docPath, 'utf8');
    assert.match(content, /## Operational Promotion Checklist/, 'Must contain promotion checklist');
    assert.match(content, /graphql-depth-limit/, 'Checklist must reference depth limit dependency');
    assert.match(content, /calculateQueryComplexity/, 'Checklist must reference complexity scoring function');
  });
});
