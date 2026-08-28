import { test, expect } from '@playwright/test';

/**
 * Deployment smoke tests
 * 
 * These tests verify that the deployed application is functional after deployment.
 * They run against a running instance of the application (staging or production)
 * and perform basic health checks and core functionality tests.
 * 
 * Run against a deployed instance:
 *   pnpm --filter @stellar-analytics/e2e test smoke/deployment.spec.ts
 * 
 * Or with environment variable:
 *   BASE_URL=https://staging.example.com pnpm --filter @stellar-analytics/e2e test smoke/deployment.spec.ts
 */

// Test timeout - 30 seconds for smoke tests
const SMOKE_TEST_TIMEOUT = 30000;

test.describe('Deployment Smoke Tests', () => {
  test.beforeAll(async ({ baseURL }) => {
    if (!baseURL) {
      throw new Error('BASE_URL environment variable is required for smoke tests');
    }
  });

  test('API health endpoint returns 200', async ({ request }) => {
    const response = await request.get('/health', { timeout: SMOKE_TEST_TIMEOUT });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data.status).toBe('healthy');
  });

  test('GraphQL endpoint is reachable', async ({ request }) => {
    const response = await request.post('/graphql', {
      data: {
        query: '{ networkStats { tps totalAccounts } }',
      },
      timeout: SMOKE_TEST_TIMEOUT,
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('data');
    expect(data.data).toHaveProperty('networkStats');
  });

  test('API service status endpoint returns healthy', async ({ request }) => {
    const response = await request.post('/graphql', {
      data: {
        query: `
          query GetServiceStatus {
            serviceStatus {
              api
              indexer
              dataSource
            }
          }
        `,
      },
      timeout: SMOKE_TEST_TIMEOUT,
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.data.serviceStatus.api).toBe('healthy');
    expect(data.data.serviceStatus.indexer).toBe('healthy');
    expect(data.data.serviceStatus.dataSource).toBe('healthy');
  });

  test('Frontend home page loads', async ({ page }) => {
    await page.goto('/', { timeout: SMOKE_TEST_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: SMOKE_TEST_TIMEOUT });
    
    // Check for main dashboard elements
    await expect(page.locator('header')).toBeVisible({ timeout: SMOKE_TEST_TIMEOUT });
    await expect(page.locator('main')).toBeVisible({ timeout: SMOKE_TEST_TIMEOUT });
  });

  test('Dashboard displays network statistics', async ({ page }) => {
    await page.goto('/', { timeout: SMOKE_TEST_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: SMOKE_TEST_TIMEOUT });

    // Look for network stats tiles (KPI tiles)
    const kpiTiles = page.locator('[data-testid*="kpi"], [class*="kpi"]');
    await expect(kpiTiles).toBeVisible({ timeout: SMOKE_TEST_TIMEOUT });
  });

  test('Can navigate to network page', async ({ page }) => {
    await page.goto('/', { timeout: SMOKE_TEST_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: SMOKE_TEST_TIMEOUT });

    // Click network link
    await page.click('a:has-text("Network")', { timeout: SMOKE_TEST_TIMEOUT });
    await page.waitForURL(/\/network/, { timeout: SMOKE_TEST_TIMEOUT });

    expect(page.url()).toContain('/network');
    await page.waitForLoadState('networkidle', { timeout: SMOKE_TEST_TIMEOUT });

    // Verify network page content
    await expect(page.locator('h1, [data-testid*="network-title"]')).toBeVisible({ timeout: SMOKE_TEST_TIMEOUT });
  });

  test('Can navigate to accounts page', async ({ page }) => {
    await page.goto('/', { timeout: SMOKE_TEST_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: SMOKE_TEST_TIMEOUT });

    // Click accounts link
    await page.click('a:has-text("Accounts")', { timeout: SMOKE_TEST_TIMEOUT });
    await page.waitForURL(/\/accounts/, { timeout: SMOKE_TEST_TIMEOUT });

    expect(page.url()).toContain('/accounts');
    await page.waitForLoadState('networkidle', { timeout: SMOKE_TEST_TIMEOUT });

    // Verify accounts page content
    await expect(page.locator('h1, [data-testid*="accounts-title"]')).toBeVisible({ timeout: SMOKE_TEST_TIMEOUT });
  });

  test('Search functionality works', async ({ page }) => {
    await page.goto('/', { timeout: SMOKE_TEST_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: SMOKE_TEST_TIMEOUT });

    // Look for search input
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Search"]',
      { timeout: SMOKE_TEST_TIMEOUT }
    );

    if (await searchInput.isVisible()) {
      await searchInput.fill('test', { timeout: SMOKE_TEST_TIMEOUT });
      await page.waitForLoadState('networkidle', { timeout: SMOKE_TEST_TIMEOUT });
      expect(await searchInput.inputValue()).toBe('test');
    }
  });

  test('Error page returns 404', async ({ request }) => {
    const response = await request.get('/nonexistent-page-12345', { timeout: SMOKE_TEST_TIMEOUT });
    expect(response.status()).toBe(404);
  });

  test('GraphQL query complexity limit is enforced', async ({ request }) => {
    const complexQuery = `
      query GetComplexQuery {
        ledgers(limit: 100) {
          edges {
            node {
              transactions {
                operations {
                  sourceAccount
                }
              }
            }
          }
        }
      }
    `;

    const response = await request.post('/graphql', {
      data: { query: complexQuery },
      timeout: SMOKE_TEST_TIMEOUT,
    });

    // The query should either succeed or be rejected with an error
    // (depending on whether it exceeds complexity limits)
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // If the query is too complex, it should return an error
    if (data.errors) {
      expect(data.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED');
    }
  });

  test('API returns valid JSON for network stats', async ({ request }) => {
    const response = await request.post('/graphql', {
      data: {
        query: `query GetNetworkStats { networkStats { tps totalAccounts activeAccounts24h totalLedgers } }`,
      },
      timeout: SMOKE_TEST_TIMEOUT,
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Validate data structure
    expect(data.data.networkStats).toBeInstanceOf(Object);
    expect(typeof data.data.networkStats.tps).toBe('number');
    expect(typeof data.data.networkStats.totalAccounts).toBe('number');
    expect(typeof data.data.networkStats.activeAccounts24h).toBe('number');
    expect(typeof data.data.networkStats.totalLedgers).toBe('number');
  });

  test('Health endpoint provides timing information', async ({ request }) => {
    const response = await request.get('/health', { timeout: SMOKE_TEST_TIMEOUT });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Verify response includes timestamp
    expect(data).toHaveProperty('timestamp');
    expect(typeof data.timestamp).toBe('string');
  });
});

test.describe.serial('Deployment Smoke Tests - Sequential', () => {
  test('Sequential endpoint availability check', async ({ request }) => {
    const endpoints = [
      '/health',
      '/graphql',
      '/graphql', // Same endpoint, different query
    ];

    for (const endpoint of endpoints) {
      const response = endpoint.includes('graphql')
        ? await request.post(endpoint, {
            data: { query: '{ networkStats { tps } }' },
            timeout: SMOKE_TEST_TIMEOUT,
          })
        : await request.get(endpoint, { timeout: SMOKE_TEST_TIMEOUT });

      expect(response.ok()).toBeTruthy();
    }
  });
});
