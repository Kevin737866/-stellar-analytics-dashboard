# Troubleshooting E2E Tests

## Common Issues & Solutions

### 1. Tests Timeout

**Symptom**: "Timeout 30000ms exceeded"

**Solutions**:
```bash
# Increase timeout in playwright.config.ts
timeout: 60 * 1000, // 60 seconds

# Or per test
test.setTimeout(60000);

# Or with option
test('name', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 });
});
```

### 2. Authentication Fails

**Symptom**: "Login failed" or "Unauthorized"

**Check**:
- [ ] Test user exists in database
- [ ] API is running (`pnpm dev:api`)
- [ ] GraphQL endpoint is accessible
- [ ] JWT secret matches between tests and API

**Debug**:
```typescript
import { loginViaGraphQL } from './fixtures/auth';

test('debug auth', async ({ page }) => {
  try {
    await loginViaGraphQL(page, 'test@example.com', 'password');
  } catch (error) {
    console.log('Auth error:', error);
    throw error;
  }
});
```

### 3. Flaky Tests (pass/fail randomly)

**Common Causes**:
- Hardcoded `page.waitForTimeout(500)` delays
- Missing network waits
- Race conditions
- Test data not seeded

**Solutions**:
```typescript
// ❌ BAD - Hardcoded wait
await page.waitForTimeout(500);

// ✅ GOOD - Wait for condition
await page.waitForLoadState('networkidle');
await page.locator('[data-testid="result"]').isVisible();

// ❌ BAD - Race condition
await page.click('button');
const text = await page.locator('p').textContent();

// ✅ GOOD - Wait for expected state
await page.click('button');
await page.locator('[data-testid="result"]').isVisible();
const text = await page.locator('p').textContent();
```

### 4. Locators Not Finding Elements

**Symptom**: "locator.click: Timeout 30000ms exceeded"

**Debug Steps**:
```bash
# Use codegen to find the selector
pnpm test:e2e:codegen

# Or use debug mode
pnpm test:e2e:debug
```

**Common Selector Issues**:
```typescript
// ❌ FRAGILE - Whitespace sensitive
page.locator('text=Click Me')

// ✅ ROBUST - Has-text is flexible
page.locator('button:has-text("Click Me")')

// ❌ FRAGILE - Index-based
page.locator('div:nth-child(3) button')

// ✅ ROBUST - Test ID
page.locator('[data-testid="submit-button"]')
```

### 5. Tests Pass Locally But Fail in CI

**Common Causes**:
- Environment variables not set
- Database not initialized
- Services not started
- Different timing in CI

**Solutions**:
```bash
# Check environment
echo $BASE_URL
echo $DATABASE_URL

# Verify services
curl http://localhost:4000/graphql
curl http://localhost:5173/

# Check CI logs
gh run view <run-id> --log

# Run test with debugging
CI=true pnpm test:e2e:debug
```

### 6. Database Issues

**Symptom**: "FATAL: database does not exist"

**Solutions**:
```bash
# Create test database
createdb stellar_analytics_test

# Run migrations
pnpm --filter @stellar-analytics/api exec npm run migrate

# Seed test data
pnpm --filter @stellar-analytics/api exec npm run seed-test-data

# Check connection
psql -d stellar_analytics_test -U stellar_user
```

### 7. Port Already in Use

**Symptom**: "Error: listen EADDRINUSE :::4000"

**Solutions**:
```bash
# Kill process on port
lsof -i :4000
kill -9 <PID>

# Or change port in config
VITE_PORT=3001 pnpm dev:frontend
```

### 8. Screenshot/Video Storage Issues

**Symptom**: "Error: ENOSPC no space left on device"

**Solutions**:
```bash
# Clear old test artifacts
rm -rf packages/e2e/test-results/
rm -rf packages/e2e/playwright-report/
rm -rf packages/e2e/blob-report/

# Or configure storage limits in playwright.config.ts
video: 'retain-on-failure',
retries: 1, // Limit video recording
```

### 9. CSS/Styling Not Applied

**Symptom**: Elements not visible or positioned incorrectly

**Debug**:
```typescript
// Check computed styles
const styles = await page.locator('button').evaluate((el) => {
  const computed = window.getComputedStyle(el);
  return {
    display: computed.display,
    visibility: computed.visibility,
    opacity: computed.opacity,
  };
});
console.log(styles);

// Check if element is in viewport
const isVisible = await page.locator('button').isInViewport();
```

### 10. GraphQL Query Failures

**Symptom**: "GraphQL error: Cannot query field"

**Debug**:
```typescript
// Monitor GraphQL requests
page.on('request', (request) => {
  if (request.url().includes('/graphql')) {
    console.log('GraphQL Query:', request.postDataJSON());
  }
});

page.on('response', async (response) => {
  if (response.url().includes('/graphql')) {
    console.log('GraphQL Response:', await response.json());
  }
});
```

## Performance Issues

### Tests Running Slowly

```bash
# Run single test file
pnpm test:e2e -- auth.spec.ts

# Run specific test
pnpm test:e2e -- --grep "should login"

# Parallel execution
pnpm test:e2e -- --workers=4

# Only chromium (faster)
pnpm test:e2e:chrome
```

### High Memory Usage

```bash
# Run with limited workers
pnpm test:e2e -- --workers=1

# Disable video/trace
PLAYWRIGHT_DISABLE_TRACE=1 pnpm test:e2e

# Disable screenshots
PLAYWRIGHT_DISABLE_SCREENSHOT=1 pnpm test:e2e
```

## Browser Failure Metadata

Every failed attempt automatically attaches a `browser-failure-metadata.json`
file to the test result (issue #456). It is the fastest way to answer "which
browser was this?" before digging through traces.

Where to find it:

- **HTML report** — open the failed test and use the *Attachments* tab.
- **On disk** — `packages/e2e/test-results/<test-id>/browser-failure-metadata.json`
  (next to the screenshot, video and trace).
- **CI** — download the `e2e-test-results` or `visual-regression-results`
  artifact; it contains the whole `test-results/` directory.

The CI log also prints one summary line:

```text
[failure-metadata] browser-failure-metadata: firefox 141.0 project=firefox viewport=1280x720 retry=1 url=http://localhost:5173/ ci=github-actions (run 123#2)
```

Fields worth reading first:

| Field | Use it to |
| --- | --- |
| `browser.name` / `browser.version` | Reproduce with the exact build (`pnpm exec playwright install <name>`). |
| `test.project` | Re-run only that project: `pnpm --filter @stellar-analytics/e2e test --project="<project>"`. |
| `test.retry` | Distinguish the first failure from a retry (retries re-record metadata each attempt). |
| `environment.viewport` / `deviceScaleFactor` / `isMobile` | Catch layout assertions that depend on the emulated device. |
| `environment.userAgent` / `locale` / `timezoneId` / `colorScheme` | Catch rendering and formatting differences. |
| `ci.runId` / `ci.sha` / `ci.job` | Jump straight to the failing GitHub Actions job. |
| `failure.message` / `failure.stack` | Read the assertion without opening the trace. |

If the metadata is missing for a failure, the page fixture itself likely threw
during setup — check the setup error first.

## Visual Regression Baseline Mismatches

A pixel diff means the rendered UI changed, not that the baseline is wrong.

```bash
# Compare against committed baselines (same mode CI uses)
pnpm --filter @stellar-analytics/e2e test:visual

# Inspect expected/actual/diff PNGs
ls packages/e2e/test-results/**/*-diff.png
```

Download the `visual-regression-diffs` artifact when triaging CI failures.
Only run `test:visual:update` once you have explained the change, and commit
the regenerated baselines in the PR that caused them. Retention of committed
baselines versus CI artifacts — and the orphan-baseline check — is documented
in [`VISUAL_BASELINES.md`](./VISUAL_BASELINES.md).

## Browser-Specific Issues

### Chrome Tests Fail
```bash
# Reinstall Chrome
pnpm --filter @stellar-analytics/e2e exec playwright install chromium

# Run only Chrome
pnpm test:e2e:chrome

# Debug Chrome-specific issue
CHROMIUM_DEBUG=1 pnpm test:e2e:chrome
```

### Firefox Tests Fail
```bash
# Reinstall Firefox
pnpm --filter @stellar-analytics/e2e exec playwright install firefox

# Firefox requires special handling
test.use({ ...devices['Desktop Firefox'] });
```

### Safari Tests Fail
```bash
# Reinstall WebKit
pnpm --filter @stellar-analytics/e2e exec playwright install webkit

# WebKit has limited features
// Some APIs not available in WebKit
```

## CI/CD Issues

### GitHub Actions Timeout

Edit `.github/workflows/e2e-tests.yml`:
```yaml
jobs:
  test:
    timeout-minutes: 60  # Increase timeout
```

### CI Retries Not Working

```yaml
# In workflow file
- name: Run E2E tests
  run: pnpm test:e2e
  continue-on-error: true

- name: Retry failed tests
  if: failure()
  run: pnpm test:e2e
```

### Out of Memory in CI

```yaml
# Add memory optimization
env:
  NODE_OPTIONS: --max-old-space-size=2048
```

## Getting Help

1. **Check logs**:
   ```bash
   pnpm test:e2e --reporter=verbose
   ```

2. **Use debug mode**:
   ```bash
   pnpm test:e2e:debug
   ```

3. **Generate test code**:
   ```bash
   pnpm test:e2e:codegen
   ```

4. **View reports**:
   ```bash
   pnpm --filter @stellar-analytics/e2e exec playwright show-report
   ```

5. **Check GitHub Issues**:
   - [Playwright Issues](https://github.com/microsoft/playwright/issues)
   - [Project Issues](https://github.com/Kevin737866/-stellar-analytics-dashboard/issues)

## Advanced Debugging

### Inspect Network Traffic
```typescript
page.on('request', (request) => {
  console.log('>>', request.method(), request.url());
});

page.on('response', (response) => {
  console.log('<<', response.status(), response.url());
});
```

### Log Page Console
```typescript
page.on('console', (msg) => {
  console.log('PAGE LOG:', msg.type(), msg.text());
});

page.on('pageerror', (error) => {
  console.log('PAGE ERROR:', error);
});
```

### Capture Network HAR
```typescript
// In playwright.config.ts
use: {
  recordHar: { path: 'test-data/path.har' },
}
```

### Step-by-Step Debugging
```bash
# Run test with debugger
pnpm test:e2e:debug

# In debugger:
# - Step through code
# - Inspect page state
# - Execute console commands
# - Set breakpoints
```
