# Code Ownership

This document defines which teams are responsible for each service area in the monorepo. It is the human-readable companion to [`.github/CODEOWNERS`](../.github/CODEOWNERS), which GitHub uses to automatically request reviews on pull requests.

When a PR touches files in multiple areas, all matching teams are requested simultaneously. If owners disagree on an approach, escalate to `@stellar-analytics/maintainers` for a final decision.

---

## Teams

| Team | GitHub handle | Primary responsibilities |
|------|--------------|--------------------------|
| `@stellar-analytics/maintainers` | `@stellar-analytics/maintainers` | Repo-level config, shared package, documentation, cross-cutting architecture decisions |
| `@stellar-analytics/indexer-team` | `@stellar-analytics/indexer-team` | Data ingestion, Horizon polling, backfill logic, database schema and migrations |
| `@stellar-analytics/api-team` | `@stellar-analytics/api-team` | GraphQL API, resolvers, DataLoader, Redis caching, rate limiting |
| `@stellar-analytics/frontend-team` | `@stellar-analytics/frontend-team` | React dashboard, Apollo Client, i18n, theming, Vitest unit tests |
| `@stellar-analytics/qa-team` | `@stellar-analytics/qa-team` | Playwright E2E suite, cross-browser config, test data fixtures |
| `@stellar-analytics/platform-infra` | `@stellar-analytics/platform-infra` | CI/CD workflows, Docker Compose, backup scripts, infrastructure config |

---

## Service Area Ownership

### Shared (`shared/`, `packages/shared/`)

**Owner:** `@stellar-analytics/maintainers`

Contains TypeScript types, network configuration, and utility functions used by every other package. A change here can break any consumer in the monorepo, so reviews require extra care.

**Scope:**
- Shared TypeScript interfaces and enums (`packages/shared/src/types/`)
- Cross-package utility functions (`packages/shared/src/utils/`)
- Application-wide constants (`packages/shared/src/constants/`)

**Acceptance criteria:**
- All exported types are documented with JSDoc comments.
- No runtime dependency on Node.js built-ins — the package must be importable in browser contexts.
- Every breaking change to an exported interface bumps the shared package version and updates all consumers in the same PR.
- `pnpm -r type-check` passes with zero errors after the change.

---

### Indexer (`indexer/`, `packages/indexer/`)

**Owner:** `@stellar-analytics/indexer-team`  
**Co-owner (database migrations):** `@stellar-analytics/platform-infra`

Polls the Stellar Horizon API, normalises ledger / transaction / operation / payment records, writes them to PostgreSQL in bulk, and broadcasts real-time updates over WebSocket.

**Scope:**
- Horizon API polling and backfill logic (`indexer/src/services/`, `packages/indexer/src/services/`)
- Database migration files (`packages/indexer/migrations/`)
- Indexer configuration and validation (`indexer/src/config.ts`, `packages/indexer/src/config.ts`)
- Health check endpoint

**Acceptance criteria:**
- New ingestion logic has corresponding unit tests in `indexer/tests/` or `packages/indexer/tests/`.
- Config changes update the relevant `.env.example` and config validation schema.
- Every database schema change includes both an `up` and a `down` migration; migration tests pass in CI.
- The `GET /health` endpoint reflects the status of any new external dependency introduced.
- No raw `process.env` access outside the designated config module.
- `pnpm type-check:indexer` produces zero errors.

---

### API (`api/`, `packages/api/`)

**Owner:** `@stellar-analytics/api-team`

Express + GraphQL server. Serves dashboard data from PostgreSQL, applies Redis caching, enforces rate limits, and exposes DataLoader-batched resolvers. The `api/` directory is the root-level service; `packages/api/` is the monorepo-workspace version — both are owned by this team.

**Scope:**
- GraphQL schema definitions (`api/src/schema.ts`, `packages/api/src/schema/`)
- Resolver implementations (`api/src/resolvers/`, `packages/api/src/resolvers/`)
- DataLoader batching (`api/src/loaders.ts`, `packages/api/src/loaders/`)
- Caching layer and Redis integration
- Rate limiting, security headers, CORS configuration

**Acceptance criteria:**
- New queries and mutations are added to the GraphQL schema with matching resolver implementation and JSDoc.
- Every resolver that can trigger N+1 queries uses DataLoader batching.
- Cache TTL choices are documented in [`CACHING.md`](../CACHING.md) with rationale.
- Rate-limit and security-header behaviour is covered by at least one integration test.
- Schema changes do not break the frontend's existing queries without a coordinated, same-PR update.
- `pnpm type-check:api` produces zero errors.

---

### Frontend (`frontend/`, `packages/frontend/`)

**Owner:** `@stellar-analytics/frontend-team`

React 18 + Vite dashboard. Uses Apollo Client for GraphQL data fetching, i18next for localisation, and a custom theme context for dark/light mode.

**Scope:**
- React components and pages (`packages/frontend/src/components/`, `packages/frontend/src/pages/`)
- Custom React hooks (`packages/frontend/src/hooks/`)
- GraphQL queries and Apollo Client config (`packages/frontend/src/graphql/`)
- Localisation files — all six locales: `en`, `de`, `es`, `fr`, `ja`, `zh` (`packages/frontend/src/i18n/locales/`)
- Theming and global styles

**Acceptance criteria:**
- New components have a corresponding unit test using Vitest + Testing Library.
- All user-facing strings are added to every locale file in the same PR — no locale can be left behind.
- Interactive elements have ARIA labels; colour contrast meets WCAG 2.1 AA.
- `pnpm --filter @stellar-analytics/frontend build` completes with zero TypeScript errors.
- New GraphQL queries are co-located in `packages/frontend/src/graphql/queries.ts` and validated against the live schema.

---

### E2E Tests (`packages/e2e/`)

**Owner:** `@stellar-analytics/qa-team`  
**Co-owner:** `@stellar-analytics/frontend-team`

Playwright test suite covering all major user workflows across Chromium, Firefox, WebKit, and mobile viewports. The QA team owns test infrastructure and stability; the frontend team co-owns because E2E tests are tightly coupled to UI behaviour.

**Scope:**
- Test specs (`packages/e2e/tests/`)
- Shared helper utilities and fixtures (`packages/e2e/tests/helpers.ts`, `packages/e2e/fixtures/`)
- Playwright configuration (`packages/e2e/playwright.config.ts`)
- Quarantine management (`packages/e2e/quarantine.json` or equivalent)
- Visual regression snapshots

**Acceptance criteria:**
- Every new user-facing feature has a corresponding E2E test in `packages/e2e/tests/` before the PR is merged.
- Tests use shared helpers from `tests/helpers.ts` rather than duplicating selectors or setup logic.
- All tests pass locally with `pnpm --filter @stellar-analytics/e2e test` before a PR is opened.
- Flaky tests are either fixed or quarantined with a linked tracking issue — no untracked flakes may be merged.
- New visual regression baselines are committed alongside the test that introduces them.

---

### Documentation (`docs/`, `README.md`, `CONTRIBUTING.md`, root `*.md`)

**Owner:** `@stellar-analytics/maintainers`  
**Co-owner (CACHING.md):** `@stellar-analytics/api-team`

All markdown guides, runbooks, and process documents. Documentation is a first-class part of the codebase — outdated or missing docs are treated as bugs.

**Scope:**
- Process guides under `docs/` (triage, ownership, dependency management, release notes, etc.)
- Operational runbooks (incident response, backup/recovery, deployment rollback)
- API usage examples and GraphQL query standards
- Root-level documents (`README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `CACHING.md`)

**Acceptance criteria:**
- Any PR that changes user-facing behaviour, API contracts, or operational procedures updates the relevant doc in the same PR.
- New docs are linked from at least one existing entry point (`CONTRIBUTING.md`, `README.md`, or a related doc's "See Also" section).
- Docs use consistent heading structure (H1 title → H2 sections → H3 subsections).
- All relative links in docs are valid — no broken cross-references.

---

### Infrastructure & CI/CD (`.github/workflows/`, `scripts/`, `docker-compose*.yml`, `tools/`)

**Owner:** `@stellar-analytics/platform-infra`  
**Co-owner (workflows):** `@stellar-analytics/maintainers`

GitHub Actions pipelines, Docker Compose definitions, backup scripts, custom ESLint tooling, and deployment utilities.

**Scope:**
- All workflow YAML files (`.github/workflows/`)
- Docker Compose definitions (`docker-compose.yml`, `docker-compose.dev.yml`)
- Database and backup scripts (`scripts/`)
- Custom ESLint plugin (`tools/eslint-rules/`)
- Dependabot configuration (`.github/dependabot.yml`)

**Acceptance criteria:**
- Workflow changes are tested on a feature branch before merging to `main`.
- Every new workflow job has a `timeout-minutes` value to prevent runaway billing.
- Docker base image pins use a specific version tag — never bare `latest`.
- Backup and maintenance script changes include a dry-run or verification step.
- Secrets and credentials are never hard-coded; GitHub Secrets or environment variables are used exclusively.
- Custom ESLint rule changes include updated rule unit tests in `tools/eslint-rules/tests/`.

---

## Review Escalation

If a PR touches multiple service areas, all relevant owners are requested automatically by GitHub via `CODEOWNERS`. When owners disagree on an approach, escalate to `@stellar-analytics/maintainers` for a binding decision.

For urgent hotfixes targeting `main`, any single owner from the relevant team may approve, but a follow-up review from the remaining owners is required within one business day.

---

## Updating This Document

When a team is renamed, a new service area is added, path patterns change, or ownership transfers:

1. Update [`.github/CODEOWNERS`](../.github/CODEOWNERS) with the new path patterns and team handles.
2. Update the teams table and the relevant service section in this file.
3. Open a PR and request review from `@stellar-analytics/maintainers`.

Both files must be updated in the same PR — they must never be out of sync.

---

## See Also

- [`.github/CODEOWNERS`](../.github/CODEOWNERS) — machine-readable ownership rules consumed by GitHub
- [`docs/contributor-issue-taxonomy.md`](./contributor-issue-taxonomy.md) — area labels used to route issues to owners
- [`docs/issue-triage-and-planning.md`](./issue-triage-and-planning.md) — how issues are triaged and assigned
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — full development workflow
