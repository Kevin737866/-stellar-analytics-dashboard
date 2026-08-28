import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../../');

describe('Database Schema Migration Checklist Audit (#493)', () => {
  const docPath = path.join(REPO_ROOT, 'docs/database-migrations.md');

  it('verifies that docs/database-migrations.md exists', () => {
    assert.strictEqual(fs.existsSync(docPath), true, 'database-migrations.md must exist');
  });

  it('contains the complete Schema Migration Operational Checklist', () => {
    const content = fs.readFileSync(docPath, 'utf8');
    assert.match(content, /## Schema Migration Operational Checklist/, 'Must contain checklist header');
    assert.match(content, /Phase 1: Pre-Migration Planning & Validation/, 'Must have Phase 1 section');
    assert.match(content, /Phase 2: Execution & Deployment/, 'Must have Phase 2 section');
    assert.match(content, /Phase 3: Post-Migration Monitoring & Rollback Protocol/, 'Must have Phase 3 section');
  });

  it('includes pre-migration safety validation requirements', () => {
    const content = fs.readFileSync(docPath, 'utf8');
    assert.match(content, /Expand & Contract/i, 'Must reference expand-and-contract pattern');
    assert.match(content, /pnpm db:migrate:down/, 'Must require local rollback testing');
    assert.match(content, /analyze-query-plans\.sh/, 'Must require explain plan analysis');
    assert.match(content, /CODE_SCHEMA_VERSION/, 'Must require updating schema version');
  });

  it('includes deployment execution commands and health verification', () => {
    const content = fs.readFileSync(docPath, 'utf8');
    assert.match(content, /pnpm backup:verify/, 'Must mandate backup verification');
    assert.match(content, /pgmigrations/, 'Must document audit table verification');
    assert.match(content, /schema_version/, 'Must document schema version table confirmation');
    assert.match(content, /SchemaVersionManager\.checkCompatibility/, 'Must require compatibility gate pass');
  });

  it('includes post-migration monitoring and dual-mode rollback procedures', () => {
    const content = fs.readFileSync(docPath, 'utf8');
    assert.match(content, /GET \/metrics/, 'Must audit operational metrics');
    assert.match(content, /indexer_errors_total/, 'Must audit indexer error metrics');
    assert.match(content, /Scenario A: Reversible/, 'Must provide reversible rollback instructions');
    assert.match(content, /Scenario B: Data corruption/, 'Must provide disaster recovery restore instructions');
    assert.match(content, /restore-backup\.sh/, 'Must reference restore script');
  });
});
