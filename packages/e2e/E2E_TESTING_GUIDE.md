# E2E Testing Documentation

## Overview

This project uses **Playwright** for end-to-end (E2E) testing. Playwright is a modern testing framework that provides:

- ✅ **Cross-browser support** (Chrome, Firefox, Safari)
- ✅ **Mobile testing** (iOS, Android emulation)
- ✅ **Responsive design testing**
- ✅ **Network interception**
- ✅ **Video/screenshot recording**
- ✅ **Debugging tools**

## Getting Started

### Installation

The E2E tests are in the `packages/e2e` directory as a separate package.

```bash
# Install dependencies from root
pnpm install

# Install Playwright browsers (one-time setup)
pnpm --filter @stellar-analytics/e2e exec playwright install --with-deps
```

### Running Tests

```bash
# Run all E2E tests (default: headless mode)
pnpm test:e2e

# Run tests with UI mode (watch mode with visual UI)
pnpm test:e2e:ui

# Run tests in headed mode (see browser)
pnpm test:e2e:headed

# Run tests in debug mode (interactive debugging)
pnpm test:e2e:debug

# Run tests on specific browser
pnpm test:e2e:chrome
pnpm test:e2e:firefox
pnpm test:e2e:webkit

# Generate test code (codegen)
pnpm test:e2e:codegen
```

## Project Structure

```
packages/e2e/
├── playwright.config.ts           # Playwright configuration
├── tests/
│   ├── fixtures/
│   │   └── auth.ts               # Authentication fixtures & helpers
│   ├── auth.spec.ts              # Authentication flow tests
│   ├── dashboard.spec.ts         # Dashboard navigation tests
│   ├── data-visualization.spec.ts # Data visualization tests
│   ├── search.spec.ts            # Search functionality tests
│   ├── details.spec.ts           # Detail page tests
│   ├── responsive.spec.ts        # Responsive design tests
│   ├── performance.spec.ts       # Performance tests
│   └── visual-regression.spec.ts # Visual regression tests
├── package.json
├── tsconfig.json
└── README.md
```

## Test Coverage

<!-- e2e-test-count: 68 -->
<!-- e2e-suite-count: 8 -->

### Test inventory

| Spec file | Tests |
|-----------|------:|
| `auth.spec.ts` | 7 |
| `dashboard.spec.ts` | 9 |
| `data-visualization.spec.ts` | 9 |
| `search.spec.ts` | 4 |
| `details.spec.ts` | 6 |
| `responsive.spec.ts` | 7 |
| `performance.spec.ts` | 6 |
| `visual-regression.spec.ts` | 20 |
| **Total** | **68** |

The counts above are verified by `indexer/src/__tests__/e2e-test-counts.test.ts`. Update this table whenever you add or remove Playwright tests.

### 1. **Authentication Tests** (`auth.spec.ts`)
- ✅ Login form display
- ✅ Form validation
- ✅ Invalid credentials handling
- ✅ Successful login flow
- ✅ Protected route access
- ✅ Already logged-in redirect
- ✅ Logout functionality

### 2. **Dashboard Navigation** (`dashboard.spec.ts`)
- ✅ Dashboard display
- ✅ Navigation menu
- ✅ Page navigation
- ✅ User menu
- ✅ Search functionality

### 3. **Data Visualization** (`data-visualization.spec.ts`)
- ✅ Chart rendering
- ✅ Metric cards
- ✅ Data tables
- ✅ Transaction data
- ✅ Network data
- ✅ Account data
- ✅ Ledger timelines
- ✅ Asset data
- ✅ GraphQL subscriptions

### 4. **Search Functionality** (`search.spec.ts`)
- ✅ Search page navigation
- ✅ Search input
- ✅ Search results display
- ✅ Clearing search

### 5. **Detail Pages** (`details.spec.ts`)
- ✅ Transaction details
- ✅ Account details
- ✅ Detail page content
- ✅ Back navigation
- ✅ 404 handling

### 6. **Responsive Design** (`responsive.spec.ts`)
- ✅ Mobile layout (Pixel 5)
- ✅ Tablet layout (iPad Pro)
- ✅ Desktop layout
- ✅ Touch interactions
- ✅ Font sizes
- ✅ Multi-column layouts

### 7. **Performance** (`performance.spec.ts`)
- ✅ Page load times
- ✅ Navigation speed
- ✅ Bundle size
- ✅ Memory leaks
- ✅ Rapid navigation
- ✅ Large data set rendering

## Authentication Fixture

The `auth.ts` fixture provides:

```typescript
// Authenticated page fixture - automatically logs in
const { authenticatedPage } = test;

// Manual login helper
await loginViaGraphQL(page, email, password);

// Clear authentication
await clearAuth(page);
```

### Example Usage

```typescript
import { test, expect } from './fixtures/auth';

test('should display dashboard', async ({ authenticatedPage }) => {
  const page = authenticatedPage;
  await page.goto('/');
  
  await expect(page.locator('main')).toBeVisible();
});
```

## Configuration

### `playwright.config.ts`

Key configurations:

```typescript
// Base URL for all tests
baseURL: 'http://localhost:5173'

// Browsers to test
projects: [
  chromium,
  firefox,
  webkit,
  'Mobile Chrome',
  'Mobile Safari'
]

// Screenshots and videos on failure
screenshot: 'only-on-failure'
video: 'retain-on-failure'
trace: 'on-first-retry'

// Automatic dev server startup
webServer: [
  { command: 'pnpm dev:frontend', url: 'http://localhost:5173' },
  { command: 'pnpm dev:api', url: 'http://localhost:4000/graphql' }
]
```

## Running Tests Locally

### Terminal 1: Start Services
```bash
# Start all services
pnpm dev

# Or individually:
pnpm dev:api
pnpm dev:frontend
pnpm dev:indexer
```

### Terminal 2: Run Tests
```bash
# Watch mode with UI
pnpm test:e2e:ui

# Or standard mode
pnpm test:e2e
```

## CI/CD Integration

E2E tests run automatically on:

- **Push to `main` or `develop` branches**
- **Pull requests to `main` or `develop` branches**
- **Nightly schedule** (cross-browser testing)

### Workflows

1. **`e2e-tests.yml`** - Main E2E test suite
   - Runs on every PR and push
   - Chromium only (faster feedback)
   - Generates JUnit report
   - Comments on PRs with results

2. **`e2e-cross-browser.yml`** - Cross-browser testing
   - Runs nightly on main
   - Tests: Chromium, Firefox, Safari
   - Tests: Mobile Chrome, Mobile Safari
   - Generates detailed reports

## Test Reports

### Local Reports

After running tests, open the HTML report:

```bash
# Web-based HTML report
pnpm --filter @stellar-analytics/e2e exec playwright show-report

# Or access directly
open packages/e2e/playwright-report/index.html
```

### CI Reports

- JUnit XML reports in artifacts
- HTML reports in artifacts
- GitHub PR comments with summary
- GitHub Checks integration

## Debugging Tests

### Visual Debug Mode
```bash
pnpm test:e2e:debug
```

### Step Through with Inspector
```bash
# Run with Playwright Inspector
PWDEBUG=1 pnpm test:e2e:headed
```

### Record Test Code
```bash
# Interactive test generator
pnpm test:e2e:codegen
```

### Screenshots and Videos
```bash
# View recordings of failed tests
pnpm --filter @stellar-analytics/e2e exec playwright show-report
```

## Best Practices

### ✅ DO

- Use semantic locators: `page.locator('button:has-text("Submit")')`
- Use `data-testid` attributes for critical elements
- Wait for network idle: `await page.waitForLoadState('networkidle')`
- Use fixtures for setup/teardown
- Test user flows, not implementation details
- Add descriptive test names
- Use `expect()` for assertions

### ❌ DON'T

- Don't use flaky selectors (index-based, text with whitespace)
- Don't hardcode wait times (use `waitForURL`, `waitForLoadState`)
- Don't test multiple flows in one test
- Don't ignore errors - investigate failures
- Don't commit tests with `.only` or `.skip`

## Common Issues

### Tests timeout on CI
- Increase timeout in `playwright.config.ts`
- Check service startup in workflow
- Verify environment variables are set

### Authentication fails in CI
- Ensure test user exists in test database
- Check auth service is running
- Verify API endpoint in config

### Tests pass locally but fail in CI
- Check environment variables
- Verify database state
- Check for race conditions
- Review CI logs carefully

## Contributing

When adding new features:

1. **Write tests first** (TDD approach)
2. **Test the happy path** - main user flow
3. **Test error cases** - validation, errors
4. **Test edge cases** - empty states, limits
5. **Add test comments** for complex scenarios

### Adding New Test Files

```typescript
import { test, expect } from './fixtures/auth';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Setup
  });

  test('should do something', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    
    // Act
    await page.click('selector');
    
    // Assert
    await expect(page).toHaveTitle('Expected Title');
  });
});
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Locator API](https://playwright.dev/docs/locators)
- [Testing Practices](https://playwright.dev/docs/intro)

## Support

For issues or questions:

1. Check the [Playwright docs](https://playwright.dev)
2. Review existing tests for examples
3. Check GitHub issues
4. Run tests with `--debug` flag
5. Use `playwright codegen` to explore selectors

## Performance Guidelines

Target metrics:

- **Test startup**: < 30s
- **Single test**: < 5s
- **All tests**: < 5 min
- **CI run**: < 10 min (with parallelization)

## Next Steps

- [ ] Add more specific test cases for edge cases
- [ ] Add visual regression tests
- [ ] Add accessibility tests (a11y)
- [ ] Add performance benchmarking
- [ ] Add load testing
- [ ] Integrate with test reporting service
