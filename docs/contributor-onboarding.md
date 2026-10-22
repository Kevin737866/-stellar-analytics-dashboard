# Contributor Onboarding Guide

Welcome! This guide takes you from a fresh clone to a merged pull request. For full coding standards, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## 1. Repository Setup

**Prerequisites:** Node.js (see [node-versions.md](./node-versions.md)), pnpm, Docker, and Git.

```bash
git clone https://github.com/Kevin737866/-stellar-analytics-dashboard.git
cd -stellar-analytics-dashboard
pnpm install
cp packages/api/.env.example packages/api/.env          # then adjust values;
cp packages/indexer/.env.example packages/indexer/.env  # see environment-variables.md
docker compose -f docker-compose.dev.yml up -d
pnpm db:migrate
```

- Environment variables: [environment-variables.md](./environment-variables.md)
- Local development: [DEVELOPMENT.md](../DEVELOPMENT.md)
- Startup problems: [startup-troubleshooting.md](./startup-troubleshooting.md)
- Architecture overview: [architecture.md](./architecture.md)

## 2. Picking an Issue

- Pick an issue that is open and unassigned, and comment to ask for it to be assigned to you before you start work.
- Labels and their meaning are described in [contributor-issue-taxonomy.md](./contributor-issue-taxonomy.md).
- Read the full issue, including its acceptance criteria and linked discussions, before writing code.

## 3. Branch Naming

Always branch from an up-to-date `main`:

```bash
git checkout main
git pull origin main
git checkout -b <type>/<issue-number>-short-description
```

| Prefix     | Use for                    |
| ---------- | -------------------------- |
| `feature/` | New functionality          |
| `fix/`     | Bug fixes                  |
| `docs/`    | Documentation-only changes |
| `chore/`   | Tooling, dependencies, CI  |

Example: `feature/419-graphql-depth-config`

## 4. Testing Requirements

Run these before you push. CI runs the same checks.

```bash
pnpm lint          # ESLint, zero warnings allowed
pnpm type-check    # TypeScript
pnpm test          # Unit tests across packages
pnpm test:schema   # GraphQL schema / query sync (when touching GraphQL)
pnpm test:e2e      # End-to-end (when touching user-facing flows)
```

- New behaviour needs focused tests next to the code, as `*.test.ts`.
- Bug fixes should include a test that fails without the fix.
- Flaky tests: follow [flaky-test-management.md](./flaky-test-management.md). Do not just retry them.
- Database changes: follow [migration-changelog-guidelines.md](./migration-changelog-guidelines.md).

## 5. Commits

Use [Conventional Commits](https://www.conventionalcommits.org/), which are enforced by commitlint:

```
feat(api): add configurable GraphQL depth limit
fix(indexer): handle empty ledger batches
docs: add contributor onboarding guide
```

## 6. Submitting a High-Quality PR

- **Small and focused**: one issue per PR where possible, with no unrelated refactors.
- **Link the issue**: include `Closes #<issue-number>` in the PR description.
- **Describe the change**: what changed, why, and how you validated it.
- **Show the UI**: attach screenshots for visual changes.
- **Update docs**: include any docs and `CHANGELOG.md` entries the change needs.
- **Keep CI green**: fix lint, type, and test failures before you request review.
- **Respond to review**: push follow-up commits and avoid force-pushing over review history.

### PR Checklist

- [ ] Branch name follows the convention
- [ ] `pnpm lint`, `pnpm type-check`, and `pnpm test` pass locally
- [ ] Tests added or updated for the change
- [ ] Documentation updated
- [ ] PR description links the issue with `Closes #<issue-number>`
