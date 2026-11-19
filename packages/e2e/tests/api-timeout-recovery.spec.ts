/**
 * API timeout recovery (issue #453)
 *
 * The dashboard is expected to stay usable when the API stalls:
 *
 *   1. a *transient* timeout is retried transparently by Apollo's RetryLink;
 *   2. a *sustained* timeout degrades gracefully — the last known values stay
 *      on screen and a dismissible/retryable warning is shown, instead of a
 *      blank page or a stuck skeleton;
 *   3. when the API recovers, the user can retry from that warning and the
 *      dashboard becomes fresh again without a full page reload.
 *
 * `fixtures/network-timeout.ts` fails GraphQL requests at the transport layer,
 * which is what a network timeout looks like to Apollo.
 */

import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth';
import { GraphQlTimeoutSimulator } from './fixtures/network-timeout';

/** Metric cards rendered by DashboardPage once data (real or fallback) exists. */
const metricCards = (page: Page) => page.locator('article.card');

/** Warning banner DashboardPage shows while stale/fallback data is displayed. */
const staleDataWarning = (page: Page) =>
  page.getByRole('alert').filter({ hasText: 'Could not refresh data' });

test.describe('API timeout recovery', () => {
  test('recovers automatically when a transient timeout clears', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // Fail exactly one GraphQL request. Apollo retries it and the retry is
    // served by the real API, so the outage never reaches the user.
    const api = await GraphQlTimeoutSimulator.install(page, { failures: 1 });

    try {
      await page.goto('/');

      // Real data means the retried query succeeded: fallback stats render
      // zero cards, so assert on a non-zero metric value instead.
      const totalLedgersCard = page.locator('article.card').filter({ hasText: 'Total Ledgers' });

      await expect(totalLedgersCard).toBeVisible({ timeout: 25_000 });
      await expect(totalLedgersCard.locator('p')).not.toHaveText(/^0(\.0+)?$/);

      expect(api.failedAttempts).toBe(1);
      expect(api.attempts).toBeGreaterThan(1);

      // The retry succeeded, so no warning should ever be shown.
      await expect(staleDataWarning(page)).toHaveCount(0);
    } finally {
      await api.remove();
    }
  });

  test('keeps the dashboard usable while the API times out', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const api = await GraphQlTimeoutSimulator.install(page);

    try {
      await page.goto('/');

      // After the retry budget is exhausted the dashboard shows what it has
      // (fallback stats) plus a warning — it must not be blank or stuck on a
      // loading skeleton.
      await expect(staleDataWarning(page)).toBeVisible({ timeout: 30_000 });
      await expect(metricCards(page).first()).toBeVisible();

      // The shell is still interactive: navigation and the tab controls work.
      await expect(page.locator('h1')).toBeVisible();
      const transactionsTab = page.getByRole('button', { name: /Transactions/ });
      await expect(transactionsTab).toBeVisible();

      // Retry is offered directly from the warning.
      await expect(staleDataWarning(page).getByRole('button', { name: /Retry/i })).toBeVisible();

      // Several attempts were made (initial request + RetryLink retries).
      expect(api.failedAttempts).toBeGreaterThan(1);
    } finally {
      await api.remove();
    }
  });

  test('recovers when the user retries after the API returns', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    const api = await GraphQlTimeoutSimulator.install(page);

    try {
      await page.goto('/');
      await expect(staleDataWarning(page)).toBeVisible({ timeout: 30_000 });

      // API comes back, then the user retries from the warning banner.
      api.allowRequests();
      await staleDataWarning(page).getByRole('button', { name: /Retry/i }).click();

      // The warning clears once the refresh succeeds and fresh data is shown.
      await expect(staleDataWarning(page)).toHaveCount(0, { timeout: 15_000 });

      const totalLedgersCard = page.locator('article.card').filter({ hasText: 'Total Ledgers' });
      await expect(totalLedgersCard.locator('p')).not.toHaveText(/^0(\.0+)?$/, { timeout: 15_000 });
    } finally {
      await api.remove();
    }
  });
});
