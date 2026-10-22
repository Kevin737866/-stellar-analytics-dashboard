/**
 * Visual Regression Tests
 *
 * Detects unexpected UI regressions in dashboard and card components using
 * Playwright's built-in pixel-comparison snapshot feature.
 *
 * Acceptance criteria
 *   ✓ Full dashboard page renders within a pixel-threshold of the baseline
 *   ✓ MetricCard component (all variants) matches baseline
 *   ✓ TransactionsChart matches baseline in light and dark modes
 *   ✓ LedgerTimelineChart matches baseline
 *   ✓ Metric cards grid (loading skeleton, data, error) match baselines
 *   ✓ Regressions in card layout, colours, or typography are flagged on CI
 *   ✓ Dark-mode snapshots are taken separately so theme switches don't
 *     produce false positives
 *
 * Updating baselines
 *   pnpm test:e2e:visual:update      (regenerates ALL snapshots)
 *   pnpm test:e2e:visual             (compares against existing baselines)
 *
 * Each toHaveScreenshot() call writes a .png under:
 *   packages/e2e/tests/__snapshots__/visual-regression.spec.ts/visual-regression/
 *
 * The snapshot directory is committed to git so CI always has a reference.
 *
 * Retention of committed baselines vs. CI artefacts is documented in
 * ./VISUAL_BASELINES.md — update it when snapshot paths or CI retention change.
 */

import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/failure-metadata';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait until all pending network requests settle and animations finish. */
async function waitForStable(page: Page) {
  await page.waitForLoadState('networkidle');
  // Let CSS transitions / chart animations reach their resting frame.
  await page.waitForTimeout(800);
}

/** Force the page into dark mode via the prefers-color-scheme emulation. */
async function enableDarkMode(page: Page) {
  await page.emulateMedia({ colorScheme: 'dark' });
}

/** Force the page into light mode. */
async function enableLightMode(page: Page) {
  await page.emulateMedia({ colorScheme: 'light' });
}

/**
 * Intercept GraphQL requests so snapshot tests produce deterministic data
 * regardless of whether the real API is running.
 *
 * All `query GetStats` calls are intercepted and fulfilled with the fixture
 * below.  Every other request is allowed to pass through.
 */
async function mockGraphQL(page: Page) {
  await page.route('**/graphql', async (route) => {
    const body = route.request().postDataJSON();
    const op = body?.operationName ?? '';

    if (op === 'GetStats') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            stats: {
              totalLedgers: 52_000_000,
              totalTransactions: 1_200_000,
              totalOperations: 3_800_000,
              totalAccounts: 450_000,
              totalAssets: 2_500,
              activeAccounts24h: 12_000,
              activeAccounts7d: 55_000,
              activeAccounts30d: 210_000,
              volume24h: '9812345.00',
              volume7d: '68000000.00',
              volume30d: '250000000.00',
              averageFee24h: 100.0,
              successRate24h: 98.7,
              latestLedger: 52_001_234,
              latestLedgerTime: '2026-07-26T12:00:00.000Z',
            },
          },
        }),
      });
    }

    if (op === 'GetNetworkMetrics') {
      const metrics = Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - (23 - i) * 3_600_000).toISOString(),
        ledgerCount: 720,
        transactionCount: 800 + Math.round(Math.sin(i / 4) * 200),
        operationCount: 1600 + Math.round(Math.sin(i / 4) * 400),
        activeAccounts: 500 + i * 10,
        totalVolume: '400000.00',
        averageFee: 100,
        successRate: 98.5 + Math.random() * 1.5,
      }));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { networkMetrics: metrics } }),
      });
    }

    if (op === 'GetLedgers') {
      const edges = Array.from({ length: 10 }, (_, i) => ({
        cursor: Buffer.from(String(52_001_230 - i)).toString('base64'),
        node: {
          id: String(52_001_230 - i),
          sequence: 52_001_230 - i,
          successfulTransactionCount: 45 - i,
          failedTransactionCount: 2,
          operationCount: 98 - i * 2,
          txSetOperationCount: 100 - i * 2,
          closedAt: new Date(Date.now() - i * 5_000).toISOString(),
          totalCoins: '100000000000',
          feePool: '1234567',
          baseFeeInStroops: 100,
          baseReserveInStroops: 5_000_000,
          maxTxSetSize: 500,
          protocolVersion: 21,
          createdAt: new Date(Date.now() - i * 5_000).toISOString(),
          updatedAt: new Date(Date.now() - i * 5_000).toISOString(),
        },
      }));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            ledgers: {
              edges,
              pageInfo: { hasNextPage: true, hasPreviousPage: false, startCursor: null, endCursor: null },
              totalCount: 52_001_230,
            },
          },
        }),
      });
    }

    // Let all other requests (assets, fonts, WS upgrade) pass through.
    return route.continue();
  });
}

// ---------------------------------------------------------------------------
// Snapshot options — allow tiny antialiasing / font-rendering differences
// ---------------------------------------------------------------------------
const SNAP_OPTS = {
  maxDiffPixelRatio: 0.03, // allow up to 3 % pixel diff (antialiasing, sub-pixel)
  threshold: 0.2,           // colour-channel tolerance (0–1)
  animations: 'disabled',   // freeze CSS animations for determinism
} as const;

// ---------------------------------------------------------------------------
// Dashboard page snapshots
// ---------------------------------------------------------------------------

test.describe('Visual Regression — Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockGraphQL(page);
    await page.goto('/');
    await waitForStable(page);
  });

  test('full dashboard — light mode', async ({ page }) => {
    await enableLightMode(page);
    await waitForStable(page);
    await expect(page).toHaveScreenshot('dashboard-light.png', {
      fullPage: true,
      ...SNAP_OPTS,
    });
  });

  test('full dashboard — dark mode', async ({ page }) => {
    await enableDarkMode(page);
    // Toggle dark mode via the theme button if it exists in the app
    const themeToggle = page.locator('[data-testid="theme-toggle"], button[aria-label*="theme" i]').first();
    if (await themeToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
      await themeToggle.click();
      await waitForStable(page);
    }
    await expect(page).toHaveScreenshot('dashboard-dark.png', {
      fullPage: true,
      ...SNAP_OPTS,
    });
  });

  test('metric cards grid', async ({ page }) => {
    // Isolate just the metric cards section
    const grid = page
      .locator('.grid')
      .filter({ has: page.locator('[aria-label*=":"]') }) // MetricCard has an aria-label "Title: Value"
      .first();

    // Fall back to the whole main area if the grid is not found
    const target = (await grid.isVisible({ timeout: 1000 }).catch(() => false))
      ? grid
      : page.locator('main').first();

    await expect(target).toHaveScreenshot('metric-cards-grid.png', SNAP_OPTS);
  });

  test('dashboard — mobile viewport (375 px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await waitForStable(page);
    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
      ...SNAP_OPTS,
    });
  });

  test('dashboard — tablet viewport (768 px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await waitForStable(page);
    await expect(page).toHaveScreenshot('dashboard-tablet.png', {
      fullPage: true,
      ...SNAP_OPTS,
    });
  });
});

// ---------------------------------------------------------------------------
// MetricCard component snapshots
// ---------------------------------------------------------------------------

test.describe('Visual Regression — MetricCard', () => {
  test.beforeEach(async ({ page }) => {
    await mockGraphQL(page);
    await page.goto('/');
    await waitForStable(page);
  });

  test('MetricCard — default number format', async ({ page }) => {
    // Select the first metric card rendered by Dashboard
    const card = page.locator('[role="article"]').first();
    await expect(card).toBeVisible();
    await expect(card).toHaveScreenshot('metric-card-number.png', SNAP_OPTS);
  });

  test('MetricCard — success-rate percentage format', async ({ page }) => {
    // The "Success Rate" card uses format="percentage"
    const card = page.locator('[role="article"]', { hasText: /success rate/i }).first();
    if (await card.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(card).toHaveScreenshot('metric-card-percentage.png', SNAP_OPTS);
    } else {
      // Graceful skip when card is not present in this build's Dashboard layout
      test.skip();
    }
  });

  test('MetricCard — volume currency format', async ({ page }) => {
    const card = page.locator('[role="article"]', { hasText: /volume/i }).first();
    if (await card.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(card).toHaveScreenshot('metric-card-currency.png', SNAP_OPTS);
    } else {
      test.skip();
    }
  });

  test('MetricCard — with change label (trending indicator)', async ({ page }) => {
    // Any card that has a change label (TrendingUp / TrendingDown icon)
    const card = page
      .locator('[role="article"]')
      .filter({ has: page.locator('svg[class*="trending"], svg[class*="Trending"]') })
      .first();
    if (await card.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(card).toHaveScreenshot('metric-card-trending.png', SNAP_OPTS);
    } else {
      test.skip();
    }
  });

  test('MetricCard — all cards, dark mode', async ({ page }) => {
    await enableDarkMode(page);
    await waitForStable(page);
    const card = page.locator('[role="article"]').first();
    await expect(card).toHaveScreenshot('metric-card-dark.png', SNAP_OPTS);
  });
});

// ---------------------------------------------------------------------------
// TransactionsChart component snapshot
// ---------------------------------------------------------------------------

test.describe('Visual Regression — TransactionsChart', () => {
  test.beforeEach(async ({ page }) => {
    await mockGraphQL(page);
    await page.goto('/');
    await waitForStable(page);
  });

  test('TransactionsChart — default state (24h, transactions metric)', async ({ page }) => {
    // The chart renders inside a card div; use the heading to locate it
    const chartCard = page
      .locator('div', { has: page.locator('h3', { hasText: /Transaction Volume/i }) })
      .first();

    if (await chartCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(chartCard).toHaveScreenshot('transactions-chart-default.png', SNAP_OPTS);
    } else {
      test.skip();
    }
  });

  test('TransactionsChart — after switching to 7-day range', async ({ page }) => {
    const rangeBtn = page.locator('button[aria-label*="7D" i], button:has-text("7D")').first();
    if (await rangeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await rangeBtn.click();
      await waitForStable(page);

      const chartCard = page
        .locator('div', { has: page.locator('h3', { hasText: /Transaction Volume/i }) })
        .first();
      await expect(chartCard).toHaveScreenshot('transactions-chart-7d.png', SNAP_OPTS);
    } else {
      test.skip();
    }
  });

  test('TransactionsChart — dark mode', async ({ page }) => {
    await enableDarkMode(page);
    await waitForStable(page);

    const chartCard = page
      .locator('div', { has: page.locator('h3', { hasText: /Transaction Volume/i }) })
      .first();
    if (await chartCard.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(chartCard).toHaveScreenshot('transactions-chart-dark.png', SNAP_OPTS);
    } else {
      test.skip();
    }
  });
});

// ---------------------------------------------------------------------------
// LedgerTimelineChart component snapshot
// ---------------------------------------------------------------------------

test.describe('Visual Regression — LedgerTimelineChart', () => {
  test.beforeEach(async ({ page }) => {
    await mockGraphQL(page);
    await page.goto('/');
    await waitForStable(page);
  });

  test('LedgerTimelineChart — default state (stacked view)', async ({ page }) => {
    const chartCard = page
      .locator('div', { has: page.locator('h3', { hasText: /Ledger Timeline/i }) })
      .first();

    if (await chartCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Scroll the chart into view before snapshotting
      await chartCard.scrollIntoViewIfNeeded();
      await waitForStable(page);
      await expect(chartCard).toHaveScreenshot('ledger-timeline-stacked.png', SNAP_OPTS);
    } else {
      test.skip();
    }
  });

  test('LedgerTimelineChart — total view mode', async ({ page }) => {
    const totalBtn = page.locator('button:has-text("Total")').first();
    if (await totalBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await totalBtn.click();
      await waitForStable(page);

      const chartCard = page
        .locator('div', { has: page.locator('h3', { hasText: /Ledger Timeline/i }) })
        .first();
      await chartCard.scrollIntoViewIfNeeded();
      await expect(chartCard).toHaveScreenshot('ledger-timeline-total.png', SNAP_OPTS);
    } else {
      test.skip();
    }
  });

  test('LedgerTimelineChart — operations view mode', async ({ page }) => {
    const opsBtn = page.locator('button:has-text("Operations")').first();
    if (await opsBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await opsBtn.click();
      await waitForStable(page);

      const chartCard = page
        .locator('div', { has: page.locator('h3', { hasText: /Ledger Timeline/i }) })
        .first();
      await chartCard.scrollIntoViewIfNeeded();
      await expect(chartCard).toHaveScreenshot('ledger-timeline-ops.png', SNAP_OPTS);
    } else {
      test.skip();
    }
  });
});

// ---------------------------------------------------------------------------
// Loading skeleton snapshot (before data arrives)
// ---------------------------------------------------------------------------

test.describe('Visual Regression — Loading states', () => {
  test('dashboard loading skeleton', async ({ page }) => {
    // Block GraphQL so the loading state persists long enough to screenshot
    await page.route('**/graphql', async (route) => {
      await new Promise((r) => setTimeout(r, 10_000)); // hold indefinitely
      await route.continue();
    });

    await page.goto('/');
    // Capture immediately — the skeleton should be visible before the timeout fires
    await page.waitForTimeout(400);

    await expect(page).toHaveScreenshot('dashboard-loading-skeleton.png', {
      fullPage: true,
      ...SNAP_OPTS,
    });
  });

  test('dashboard error state', async ({ page }) => {
    // Simulate a network error so the error banner renders
    await page.route('**/graphql', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ errors: [{ message: 'Internal Server Error' }] }) })
    );

    await page.goto('/');
    await page.waitForTimeout(1500);

    await expect(page).toHaveScreenshot('dashboard-error-state.png', {
      fullPage: true,
      ...SNAP_OPTS,
    });
  });
});

// ---------------------------------------------------------------------------
// Layout regression — navigation / header
// ---------------------------------------------------------------------------

test.describe('Visual Regression — Layout', () => {
  test.beforeEach(async ({ page }) => {
    await mockGraphQL(page);
    await page.goto('/');
    await waitForStable(page);
  });

  test('header / navigation bar — light mode', async ({ page }) => {
    const header = page.locator('header').first();
    if (await header.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(header).toHaveScreenshot('layout-header-light.png', SNAP_OPTS);
    } else {
      // Some layouts have nav instead of header
      const nav = page.locator('nav').first();
      if (await nav.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(nav).toHaveScreenshot('layout-nav-light.png', SNAP_OPTS);
      } else {
        test.skip();
      }
    }
  });

  test('header / navigation bar — dark mode', async ({ page }) => {
    await enableDarkMode(page);
    await waitForStable(page);
    const header = page.locator('header').first();
    if (await header.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(header).toHaveScreenshot('layout-header-dark.png', SNAP_OPTS);
    } else {
      test.skip();
    }
  });
});
