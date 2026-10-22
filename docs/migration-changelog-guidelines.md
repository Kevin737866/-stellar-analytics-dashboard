# Database Migration Changelog Guidelines

This guide describes how to create, review, and roll back database migrations. For tooling details and commands, see [database-migrations.md](./database-migrations.md).

## 1. Creating a Migration

```bash
pnpm db:migrate:create <descriptive-name>
```

- Migration files live in `packages/indexer/migrations/`.
- One logical change per migration. Do not mix unrelated schema changes.
- Every migration **must** implement both `up` and `down`.
- Never edit a migration that has already been merged to `main`. Add a new migration instead.

### Naming

Files use the node-pg-migrate timestamp prefix followed by a kebab-case description:

```
<timestamp>_<verb>-<object>[-<detail>].js
```

| Good                                            | Avoid                         |
| ----------------------------------------------- | ----------------------------- |
| `1738000000000_initial-schema.js`               | `1738000000000_update.js`     |
| `1739000000000_add-ledgers-close-time-index.js` | `1739000000000_fix-stuff.js`  |
| `1740000000000_drop-legacy-metrics-table.js`    | `1740000000000_Migration2.js` |

Use verbs such as `add`, `create`, `drop`, `rename`, `alter`, `backfill`.

## 2. Changelog Entry

Each migration PR must add an entry under `## [Unreleased]` in [`CHANGELOG.md`](../CHANGELOG.md):

```markdown
### Database

- `1739000000000_add-ledgers-close-time-index` — adds index on `ledgers.close_time` for range queries. Rollback: drops the index. Backward compatible: yes.
```

Each entry states:

- **Migration file name** without the extension
- **What changes**: tables, columns, indexes, constraints
- **Rollback behaviour**: what `down` does, and whether data is lost
- **Compatibility**: whether the currently deployed code keeps working after `up`

## 3. Review Checklist

Reviewers verify the following before approving:

- [ ] File name follows the naming convention above.
- [ ] `up` and `down` are both implemented, and `down` exactly reverses `up`.
- [ ] Migration was run locally: `pnpm db:migrate`, then `pnpm db:migrate:down`, then `pnpm db:migrate` again.
- [ ] Large tables use non-blocking operations, such as `CREATE INDEX CONCURRENTLY`, where supported.
- [ ] New `NOT NULL` columns have a default value or a backfill step.
- [ ] Destructive changes (drops, type narrowing) are split from the code change that stops using them.
- [ ] `CHANGELOG.md` entry is present and complete.
- [ ] `schema_version` is bumped when the logical schema version changes.

## 4. Rollback Safety Checks

Before merging or deploying, confirm:

1. **Reversible**: `down` runs cleanly against a database migrated with `up`.
2. **Data loss is explicit**: if `down` drops data (for example, dropping an added column), the changelog entry says so.
3. **Expand / contract**: breaking changes ship in two steps:
   - _Expand_: add the new structure while keeping the old one, and deploy code that writes to both.
   - _Contract_: in a later release, remove the old structure.
4. **Backup taken**: production rollbacks of destructive migrations follow [backup-disaster-recovery.md](./backup-disaster-recovery.md).
5. **Deployment rollback plan**: see [DEPLOYMENT_ROLLBACK.md](./DEPLOYMENT_ROLLBACK.md) for the application rollback order. Roll back code first, then run `pnpm db:migrate:down` only if the schema change is incompatible.

## 5. Rolling Back

```bash
# Roll back the most recent migration
pnpm db:migrate:down
```

After a rollback, add a `CHANGELOG.md` note under `### Database` that records the reverted migration and the reason.
