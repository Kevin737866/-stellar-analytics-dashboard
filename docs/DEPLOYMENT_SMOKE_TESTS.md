# Deployment Smoke Tests

This document describes the deployment smoke tests for the Stellar Analytics Dashboard.

## Overview

Deployment smoke tests are automated tests that verify a deployed instance of the application is functional and healthy. They run against a running deployment (staging or production) and perform basic health checks and core functionality tests.

## Purpose

- **Verify deployment health**: Confirm the deployed application is responding correctly
- **Catch deployment regressions**: Detect issues introduced by new deployments
- **Provide immediate feedback**: Give confidence in the deployment before users are affected
- **Validate core functionality**: Ensure key user flows work in the deployed environment

## Test Coverage

The smoke test suite (`packages/e2e/tests/smoke/deployment.spec.ts`) includes:

### API Tests
- `/health` endpoint returns 200 and healthy status
- GraphQL endpoint is reachable and responds correctly
- Service status endpoint reports all services as healthy
- API returns valid JSON with expected data types
- Health endpoint provides timing information

### Frontend Tests
- Frontend home page loads successfully
- Dashboard displays network statistics
- Navigation to key pages (network, accounts)
- Search functionality works
- Error pages return appropriate status codes

### GraphQL Tests
- GraphQL query complexity limits are enforced
- Network stats query returns valid data
- Service status query returns expected health indicators

## Running Tests

### Locally

```bash
# Run against a local development instance
pnpm --filter @stellar-analytics/e2e test:smoke

# Run against a specific deployment URL
pnpm --filter @stellar-analytics/e2e test:smoke --url https://staging.example.com

# Run with verbose output
pnpm --filter @stellar-analytics/e2e test:smoke --url https://staging.example.com --verbose
```

### In CI/CD

The smoke tests are integrated into the CI/CD pipeline via the `deployment-smoke-tests.yml` workflow.

#### Trigger Manually

1. Navigate to the Actions tab in GitHub
2. Select "Deployment Smoke Tests" workflow
3. Click "Run workflow"
4. Enter the deployment URL and environment
5. Click "Run workflow"

#### Trigger After Deployment

The workflow automatically runs after successful "Build and Deploy" workflows, testing the deployed instance.

## Test Results

Test results are published as:

- **GitHub Checks**: Deployment smoke tests check on PRs
- **Artifacts**: Test results and reports are uploaded as artifacts
- **Comments**: PR comments with test summary (tests run, failures, errors)

## Configuration

Environment variables used by smoke tests:

| Variable | Required | Description |
|----------|----------|-------------|
| `BASE_URL` | Yes | URL of the deployed application |
| `CI` | No | Set to `true` for CI mode |
| `DEPLOYMENT_BRANCH` | No | Branch being deployed |
| `DEPLOYMENT_ENVIRONMENT` | No | Environment (staging, production) |

## Adding New Tests

1. Add test files in `packages/e2e/tests/smoke/`
2. Use Playwright's `test` and `expect` from `@playwright/test`
3. Follow existing test patterns for consistency
4. Include appropriate comments explaining what is being tested

```typescript
import { test, expect } from '@playwright/test';

test('new feature smoke test', async ({ page }) => {
  await page.goto('/feature', { timeout: 30000 });
  await expect(page.locator('.feature-element')).toBeVisible();
});
```

## Troubleshooting

### Test Fails with Connection Refused

- Verify the deployment URL is correct and accessible
- Check firewall/network settings
- Ensure the deployment is running and healthy

### Test Fails with Timeout

- Increase the `timeout` parameter in the test
- Check if the deployment is under heavy load
- Verify the application is responding within expected time

### Test Finds Unexpected Elements

- The test may need to be updated to match the current UI
- Check if there are pending UI changes
- Verify the correct URL is being tested

## Related Documentation

- [E2E Testing Guide](./E2E_TESTS_COMPLETE.md)
- [Architecture](./architecture.md)
- [Deployment Guide](./DEPLOYMENT_ROLLBACK.md)
