# Contributor Issue Taxonomy

Guide for filing, labelling, and triaging GitHub issues in the Stellar Analytics Dashboard monorepo.

<!-- taxonomy-labels: needs-triage, priority: critical, priority: high, priority: medium, priority: low, wontfix, Stellar Wave -->
<!-- taxonomy-areas: frontend, api, indexer, shared, docs, devops / ci -->

## Issue types

Use the title prefix and template that best match your work:

| Type | Title prefix | When to use | Template |
|------|--------------|-------------|----------|
| Feature | `feat:` | New behaviour or enhancement | Feature Request |
| Bug | `fix:` | Incorrect or broken behaviour | Open a bug issue (describe repro steps) |
| Documentation | `docs:` | Missing or outdated docs only | Feature Request with **docs** area |
| Shared library | `shared:` | Types/utilities in `packages/shared` | Feature Request with **shared** area |
| DevOps / CI | `ci:` | Workflows, Docker, deployment | Feature Request with **devops / ci** area |

## Area labels

Every issue should identify which monorepo area it touches. The Feature Request template exposes these as **Affected area(s)**:

| Area | Scope |
|------|-------|
| `frontend` | React dashboard (`packages/frontend`) |
| `api` | GraphQL API (`packages/api`) |
| `indexer` | Stellar ingestion pipeline (`packages/indexer`, `indexer/`) |
| `shared` | Shared types and utilities (`packages/shared`, root `shared/`) |
| `docs` | Markdown guides under `docs/` and operational runbooks |
| `devops / ci` | GitHub Actions, Docker Compose, deployment |

Select every area that your change affects. Maintainers use this to route review via CODEOWNERS.

## Workflow labels

| Label | Meaning |
|-------|---------|
| `needs-triage` | New issue awaiting RICE scoring (applied automatically by the Feature Request template) |
| `priority: critical` | Security, data loss, or production incident — current sprint |
| `priority: high` | RICE score 20–50 — next sprint |
| `priority: medium` | RICE score 5–19 — upcoming quarter |
| `priority: low` | RICE score below 5 — backlog |
| `wontfix` | Out of scope — issue will be closed |
| `Stellar Wave` | Stellar Wave Program assignment (maintainers only) |

After triage, maintainers remove `needs-triage` and assign exactly one **priority** label plus a milestone. See [`feature-triage.md`](./feature-triage.md) for the full RICE process.

## Filing checklist

Before opening an issue:

1. Search existing issues to avoid duplicates.
2. Pick the correct template and **Affected area(s)**.
3. Write measurable **acceptance criteria** (bulleted, testable outcomes).
4. Estimate effort (XS / S / M / L / XL) — refined during triage.
5. Link related PRs or docs in **References** when applicable.

## Pull request linkage

Reference the issue in your PR description so it closes automatically on merge:

```
Closes #123
```

For Wave program issues, link every issue your PR resolves.

## See also

- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — development workflow and PR checklist
- [`feature-triage.md`](./feature-triage.md) — maintainer triage meetings and RICE scoring
- [`.github/ISSUE_TEMPLATE/feature_request.yml`](../.github/ISSUE_TEMPLATE/feature_request.yml) — Feature Request fields
