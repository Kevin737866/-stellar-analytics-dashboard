# Issue Triage and Work Planning

This document is the single authoritative reference for how new issues move from first filing through sprint execution in the Stellar Analytics Dashboard monorepo. It supersedes any conflicting guidance in other docs and links to specialist guides where relevant.

---

## 1. Overview

Every piece of planned work — features, bugs, docs gaps, CI fixes — starts as a GitHub Issue. The process has four stages:

```
File → Triage → Prioritise → Plan → Execute → Close
```

Each stage has a responsible party, a time-box, and a clear exit condition that moves the issue to the next stage.

---

## 2. Filing an Issue

### Who can file

Anyone — contributors, maintainers, or users — can open an issue at any time.

### Templates

| Situation | Template to use |
|-----------|----------------|
| New feature or enhancement | **Feature Request** (`.github/ISSUE_TEMPLATE/feature_request.yml`) |
| Bug or broken behaviour | **Bug Report** (`.github/ISSUE_TEMPLATE/bug_report.yml`) |
| Documentation gap | Feature Request, select `docs` as affected area |
| CI / DevOps change | Feature Request, select `devops / ci` as affected area |

### Required fields

Every issue must include, at minimum:

- A clear **title** following the prefix convention (`feat:`, `fix:`, `docs:`, `ci:`)
- A **problem statement** — the user need or broken behaviour
- **Acceptance criteria** — bulleted, testable outcomes that define done
- **Affected area(s)** — one or more of: `frontend`, `api`, `indexer`, `shared`, `docs`, `devops / ci`
- **Estimated effort** — XS / S / M / L / XL (your best guess; refined during triage)

### On creation

The Feature Request template automatically applies the `needs-triage` label. For bugs, apply `needs-triage` manually if your template does not add it automatically.

### Avoid duplicates

Search open and closed issues before filing. If a duplicate exists, add a comment linking to the original rather than opening a new issue.

---

## 3. Triage

### Cadence

Triage runs **every two weeks**, on the first Monday of each sprint. Any maintainer can facilitate. The session is time-boxed to 30 minutes.

Urgent issues (security vulnerabilities, data-loss bugs, production incidents) bypass the scheduled triage cycle — see [Section 7: Escalation](#7-escalation).

### Who participates

- One facilitating maintainer (rotates)
- Owners of affected areas (from [`docs/code-ownership.md`](./code-ownership.md)) — optional but encouraged

### Input

All open issues labelled `needs-triage`, sorted by creation date (oldest first).

### Steps per issue

1. **Read** the issue and confirm it is complete. If information is missing, comment asking for it and leave `needs-triage` in place.
2. **Classify** — is it a feature, bug, docs gap, or something out of scope?
3. **Score** using the RICE framework (see [Section 4](#4-rice-scoring)).
4. **Assign a priority label** (see [Section 5](#5-priority-labels)).
5. **Set a milestone** — the target release or quarter, or `Backlog` if unscheduled.
6. **Remove `needs-triage`** — this signals that triage is complete.
7. **Post the triage comment** on the issue (template in [Section 8](#8-triage-comment-template)).

If an issue is clearly out of scope, apply `wontfix`, leave a polite explanation, and close it during the session.

### Output

Every issue that passes through triage has:

- No `needs-triage` label
- Exactly one priority label (`priority: critical`, `high`, `medium`, or `low`)
- A milestone
- A triage comment recording the RICE score and reasoning

---

## 4. RICE Scoring

RICE gives every issue a comparable numeric priority. Full definitions are in [`docs/feature-triage.md`](./feature-triage.md). Summary:

```
RICE = (Reach × Impact × Confidence) / Effort
```

| Dimension | What it measures | Typical values |
|-----------|-----------------|----------------|
| Reach | Users or sessions affected per month | 1 / 10 / 25 / 50 / 100 |
| Impact | Magnitude of improvement per affected user | 0.25 / 0.5 / 1 / 2 / 3 |
| Confidence | Evidence quality behind reach and impact estimates | 50 % / 80 % / 100 % |
| Effort | Person-days to design + implement + test + document | 0.5 / 1 / 3 / 8 / 20 |

Post the score as a comment on the issue using the template in [Section 8](#8-triage-comment-template). The comment is the permanent record — do not put RICE scores in the issue body.

---

## 5. Priority Labels

After scoring, assign exactly one priority label:

| Label | RICE threshold | What it means |
|-------|---------------|---------------|
| `priority: critical` | Any score, or security / data-loss | Must enter the **current** sprint immediately |
| `priority: high` | ≥ 20 | Targeted for the **next** sprint |
| `priority: medium` | 5 – 19 | Scheduled within the **upcoming quarter** |
| `priority: low` | < 5 | Added to the **Backlog** milestone |

Use the area labels from [`docs/contributor-issue-taxonomy.md`](./contributor-issue-taxonomy.md) alongside priority labels — they are complementary, not alternatives.

---

## 6. Sprint Planning

Sprint planning happens at the **start of each two-week sprint**, immediately after (or combined with) the triage session for that sprint.

### Inputs

- Issues labelled `priority: high` or `priority: critical` without an assignee
- Team capacity in person-days for the sprint
- Any carry-over from the previous sprint

### Process

1. Sort `priority: critical` issues to the top — they go in unconditionally.
2. Pull `priority: high` issues in descending RICE order until 80 % of capacity is filled.
3. Reserve ≈ 20 % of capacity for bugs, unplanned work, and tech debt.
4. Move accepted issues to the current sprint milestone.
5. Each issue gets an **assignee** — self-assignment is encouraged; the facilitator assigns if no one volunteers.

### Starting work

When an assignee begins work on an issue:

1. Apply the `status: in-progress` label.
2. Create a branch named `feat/<issue-number>-short-description` or `fix/<issue-number>-short-description`.
3. Open a **draft PR** early and link it to the issue with `Closes #<N>` in the PR description. This makes progress visible and triggers CODEOWNERS review requests automatically.

### Definition of done

An issue is done — and the PR is ready for final review — when:

- All acceptance criteria listed on the issue are met
- Relevant tests are added or updated
- `pnpm lint` and `pnpm build` pass locally
- Documentation is updated if the change affects user-facing behaviour
- The PR has at least one approving review from the code area owner (see [`docs/code-ownership.md`](./code-ownership.md))

---

## 7. Escalation

Issues that cannot wait for the next triage meeting must be escalated immediately:

| Situation | Action |
|-----------|--------|
| Security vulnerability | Label `priority: critical` + `security`, open a **private** security advisory via GitHub Security tab, notify `@stellar-analytics/maintainers` directly |
| Data-loss or corruption risk | Label `priority: critical`, ping area owner and `@stellar-analytics/platform-infra` in the issue |
| Production incident | Follow [`docs/incident-response-runbook.md`](./incident-response-runbook.md); open a tracking issue post-incident |

Critical issues bypass RICE scoring and the triage queue. They enter the current sprint immediately and are assigned before the end of the business day they are reported.

---

## 8. Triage Comment Template

After scoring an issue, post this comment. It becomes the permanent triage record.

```markdown
## Triage result

| Dimension   | Value      |
|-------------|------------|
| Reach       | _N_        |
| Impact      | _N_        |
| Confidence  | _N %_      |
| Effort      | _N days_   |
| **RICE**    | **_score_** |

**Priority**: `priority: high` _(replace with actual label)_
**Milestone**: _vX.Y.Z_ / _Q3-2026_ / _Backlog_ _(replace)_
**Notes**: _Any context, dependencies, open questions, or follow-up tasks._
```

---

## 9. Full Lifecycle Diagram

```
Issue filed (Feature Request or Bug Report)
        │
        │  labels: needs-triage + area label(s)
        ▼
  Triage queue
        │
        ▼  Bi-weekly triage meeting (≤ 30 min)
  ┌─────────────────────────────────────────┐
  │  Out of scope?  ──► wontfix + closed    │
  │  Missing info?  ──► comment + stay here │
  │  Otherwise:                             │
  │    RICE score recorded as comment       │
  │    Priority label assigned              │
  │    Milestone set                        │
  │    needs-triage removed                 │
  └─────────────────────────────────────────┘
        │
        ├── priority: low/medium  ──► Backlog / quarterly milestone
        │
        └── priority: high/critical
                │
                ▼  Sprint planning
          status: in-progress
          Assignee + branch + draft PR
                │
                ▼  Implementation
          PR ready for review
          CODEOWNERS auto-requested
                │
                ▼  Approved + all checks green
          Merged to main
          Issue closed automatically ("Closes #N" in PR)
                │
                ▼  Next release tag
          CHANGELOG updated
          Release notes published
```

---

## 10. Label Reference

A quick-reference table of all labels used in this process. Full definitions are in [`docs/contributor-issue-taxonomy.md`](./contributor-issue-taxonomy.md).

| Label | Stage applied | Applied by |
|-------|--------------|-----------|
| `needs-triage` | Filing | Template / contributor |
| `priority: critical` | Triage | Maintainer |
| `priority: high` | Triage | Maintainer |
| `priority: medium` | Triage | Maintainer |
| `priority: low` | Triage | Maintainer |
| `wontfix` | Triage | Maintainer |
| `status: in-progress` | Sprint start | Assignee |
| `security` | Any time | Maintainer |
| `breaking-change` | PR / triage | Author or maintainer |
| `dependencies` / `automated` | Dependabot PRs | Dependabot |

Area labels (`frontend`, `api`, `indexer`, `shared`, `docs`, `devops / ci`) are applied at filing time and drive CODEOWNERS review routing.

---

## See Also

- [`docs/contributor-issue-taxonomy.md`](./contributor-issue-taxonomy.md) — label definitions and filing checklist
- [`docs/feature-triage.md`](./feature-triage.md) — detailed RICE scoring guide with examples
- [`docs/code-ownership.md`](./code-ownership.md) — which team owns each area
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — development workflow and PR checklist
- [`docs/incident-response-runbook.md`](./incident-response-runbook.md) — production incident process
