# E2E Testing - Quick Start

## 5-Minute Setup

### 1. Install Playwright
```bash
cd packages/e2e
pnpm install
npx playwright install --with-deps
```

### 2. Start Services
```bash
# In one terminal
pnpm dev
```

### 3. Run Tests
```bash
# In another terminal
pnpm test:e2e:ui
```

That's it! Tests will run in a visual UI.

## Common Commands

```bash
# Run all tests (headless)
pnpm test:e2e

# Run with UI (recommended for development)
pnpm test:e2e:ui

# Debug a specific test
pnpm test:e2e:debug -- auth.spec.ts

# View test report
pnpm --filter @stellar-analytics/e2e exec playwright show-report

# Record new test
pnpm test:e2e:codegen
```

## Test Structure

Each test file follows this pattern:

```typescript
import { test, expect } from './fixtures/auth';

test.describe('Feature Name', () => {
  test('should do something', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    await page.click('selector');
    await expect(page.locator('result')).toBeVisible();
  });
});
```

## Key Files

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Test configuration |
| `tests/fixtures/auth.ts` | Login helpers |
| `tests/auth.spec.ts` | Authentication tests |
| `tests/dashboard.spec.ts` | Dashboard tests |
| `tests/data-visualization.spec.ts` | Chart/table tests |
| `tests/search.spec.ts` | Search tests |
| `tests/details.spec.ts` | Detail page tests |
| `tests/responsive.spec.ts` | Mobile/tablet tests |
| `tests/performance.spec.ts` | Performance tests |
| `tests/visual-regression.spec.ts` | Visual regression tests |

**68 Playwright tests** across 8 spec files — see the [test inventory](./E2E_TESTING_GUIDE.md#test-inventory) in `E2E_TESTING_GUIDE.md`.

## Test Capabilities

✅ **Cross-browser**: Chrome, Firefox, Safari
✅ **Mobile testing**: iPhone, Android emulation
✅ **Visual testing**: Screenshots on failure
✅ **Network monitoring**: GraphQL queries
✅ **Authentication**: Automatic login fixture
✅ **Performance**: Page load timing
✅ **Responsive design**: Multiple viewports

## Debugging

### See tests run in browser
```bash
pnpm test:e2e:headed
```

### Step through test interactively
```bash
pnpm test:e2e:debug
```

### Record test code
```bash
pnpm test:e2e:codegen
```

### View failed test videos
```bash
pnpm --filter @stellar-analytics/e2e exec playwright show-report
```

## CI Integration

Tests run automatically:
- ✅ On every pull request
- ✅ On push to main/develop
- ✅ Nightly cross-browser testing
- ✅ Generates reports and comments on PRs

## Troubleshooting

**Tests timeout?**
- Ensure services are running (`pnpm dev`)
- Check network connectivity
- Increase timeout in config if needed

**Authentication fails?**
- Verify test user exists
- Check API is responding
- Review auth fixture setup

**Flaky tests?**
- Avoid hardcoded timeouts
- Use proper waiters: `waitForURL()`, `waitForLoadState()`
- Check for race conditions

For more details, see [E2E_TESTING_GUIDE.md](./E2E_TESTING_GUIDE.md)
