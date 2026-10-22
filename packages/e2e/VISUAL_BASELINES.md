# Visual Baseline Retention

Operational policy for the Playwright visual-regression snapshots in this
package (issue #454).

The suite compares dashboard, chart, card and layout screenshots against
committed PNG baselines. Those baselines are review artefacts **and**
production reference data, so their retention is defined explicitly here
instead of being left to whoever last ran `--update-snapshots`.

## Where baselines live

`playwright.config.ts` pins a deterministic path:

```ts
snapshotPathTemplate:
  '{testDir}/__snapshots__/{testFilePath}/{projectName}/{arg}{ext}',
```

which resolves to:

```text
packages/e2e/tests/__snapshots__/visual-regression.spec.ts/visual-regression/<name>.png
```

Visual tests run **only** in the `visual-regression` project (Chromium, fixed
1440×900 viewport, animations disabled). Other browser projects ignore
`visual-regression.spec.ts`, so there is exactly one baseline file per
`toHaveScreenshot()` name.

<!-- baseline-retention-days: visual-regression-results=30, visual-regression-diffs=30, visual-regression-report=30, visual-regression-screenshots=14 -->

## Retention policy

| Artefact                                                                            | Location          | Retention                                                        | Rationale                                                                                                                                                                         |
| ----------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Committed baselines (`*.png` under `tests/__snapshots__/`)                          | Git repository    | **Indefinite** — kept for the lifetime of the corresponding test | They are the reference for every future CI run and the audit trail for UI changes; git history is the archive, so old versions are recoverable from the commit that changed them. |
| `visual-regression-results` artefact (HTML report, JUnit XML, traces)               | GitHub Actions    | **30 days**                                                      | Long enough to investigate a regression reported in the current sprint.                                                                                                           |
| `visual-regression-diffs` artefact (`*-expected.png`, `*-actual.png`, `*-diff.png`) | GitHub Actions    | **30 days**                                                      | Diff images are only needed while a failing run is being triaged.                                                                                                                 |
| `visual-regression-report` / `visual-regression-screenshots` (nightly job)          | GitHub Actions    | **30 days** / **14 days**                                        | Nightly runs are informational; screenshots age out quickly.                                                                                                                      |
| Local `test-results/` and `playwright-report/`                                      | Developer machine | **Not retained** — git-ignored                                   | Regenerated on every run; never commit them.                                                                                                                                      |

Baselines are **not** expired automatically. A baseline is deleted only when:

1. the test that owns it is removed or renamed in the same pull request, or
2. the component/page it captures is deleted, or
3. it is superseded by a reviewed `--update-snapshots` commit.

`check:baselines` (see below) fails CI when a baseline exists with no matching
test, which is how rule (1) and (2) are enforced.

## Updating baselines

```bash
# Regenerate every baseline (review the diff before committing!)
pnpm --filter @stellar-analytics/e2e test:visual:update

# Compare against the committed baselines (what CI runs)
pnpm --filter @stellar-analytics/e2e test:visual
```

Rules for a baseline change:

- Update baselines **in the same pull request** as the UI change that caused
  them, so the diff is reviewable next to the component change.
- Never refresh a baseline to silence a regression you have not explained; the
  CI failure is the signal, not the problem.
- Regenerate locally with the same Chromium version that CI installs
  (`pnpm exec playwright install chromium --with-deps`). Firefox/WebKit render
  fonts differently and would create false-positive baselines.
- Run `test:visual` (compare mode) before pushing — a stale baseline set shows
  up as a pixel diff and blocks the PR.
- The CI `update_snapshots` workflow dispatch opens a PR with regenerated
  baselines; that PR still needs a human reviewer.
- Baselines are retained indefinitely in git, so the update commit is the
  permanent record of the visual change. Write a commit message that says which
  UI change produced it.

## Stale and orphaned baselines

```bash
# Verify every committed baseline is still referenced by a test
pnpm --filter @stellar-analytics/e2e check:baselines

# Machine-readable output for tooling
pnpm --filter @stellar-analytics/e2e check:baselines -- --json
```

The check exits non-zero when it finds an **orphaned** baseline (a PNG with no
matching `toHaveScreenshot()` call) and prints the files to delete. Missing
baselines are reported as warnings only: the first run on a clean checkout has
none until they are generated and committed, and Playwright reports those as
failures itself once the suite runs.

`check:baselines` runs as a gate in `.github/workflows/visual-regression.yml`
before the snapshot comparison, so orphaned baselines cannot accumulate.

## Review cadence and ownership

- **Per pull request:** the author reviews any baseline diff introduced by the
  PR; reviewers compare the new PNG against the expected UI change.
- **Monthly:** the frontend maintainer on rotation runs `check:baselines` and
  deletes orphaned files, then confirms the workflow retention still matches
  the table above.
- **After a Playwright or Chromium upgrade:** regenerate baselines once, in a
  dedicated PR, so rendering noise is not mixed with feature changes.

## Related documentation

- [`E2E_TESTING_GUIDE.md`](./E2E_TESTING_GUIDE.md) — running the suite and CI
  integration.
- [`playwright.config.ts`](./playwright.config.ts) — snapshot path template and
  the `visual-regression` project.
- [`.github/workflows/visual-regression.yml`](../../.github/workflows/visual-regression.yml)
  — comparison run, snapshot-update job and artefact retention.
