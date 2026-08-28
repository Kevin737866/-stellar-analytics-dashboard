# Supported Node.js Versions

This document is the single source of truth for Node.js and pnpm version requirements across the Stellar Analytics Dashboard monorepo.

<!-- node-min-version: 18 -->
<!-- node-recommended-version: 20 -->
<!-- node-ci-version: 20 -->
<!-- pnpm-min-version: 9 -->

## Summary

| Context | Node.js | pnpm | Notes |
|---------|---------|------|-------|
| Local development (minimum) | **18.x** | **9.x** | Builds and unit tests must pass |
| Local development (recommended) | **20.x LTS** | **9.12.0** | Matches CI; fewer toolchain surprises |
| GitHub Actions CI | **20.x** | **9.12.0** | All workflows use `node-version: '20'` |
| Production containers | **20.x** | bundled in image | See service Dockerfiles |

## Version policy

- **Node 18** is the minimum supported runtime for local development. Older versions are unsupported and may fail during install, build, or test.
- **Node 20 LTS** is recommended for day-to-day work and is the version used in every GitHub Actions workflow (`.github/workflows/*.yml`).
- **Node 22+** may work but is not validated in CI; use Node 20 when debugging CI-only failures.
- **pnpm 9** is required. The workspace pins `pnpm@9.12.0` via the root `packageManager` field.

## Quick setup

```bash
# Verify versions
node --version   # expect v18.x or v20.x
pnpm --version   # expect 9.x

# Recommended: align with CI
nvm install 20
nvm use 20
npm install -g pnpm@9
```

An `.nvmrc` file at the repo root pins **20** for contributors using [nvm](https://github.com/nvm-sh/nvm).

## Where versions are enforced

| Location | What it defines |
|----------|-----------------|
| Root `package.json` → `engines` | Minimum Node 18 and pnpm 9 |
| Root `package.json` → `packageManager` | Exact pnpm version for Corepack |
| `.nvmrc` | Recommended Node 20 for local dev |
| `.github/workflows/ci.yml` (and other workflows) | CI Node 20 |
| `DEVELOPMENT.md` § Prerequisites | Onboarding checklist |
| `docs/startup-troubleshooting.md` | Node mismatch troubleshooting |

## Troubleshooting

If `pnpm install` or `pnpm dev` fails with syntax or module errors, check your Node version first:

```bash
node --version
```

Switch to Node 20 if you are on an older runtime. See `docs/startup-troubleshooting.md` § Node version mismatch for additional steps.
