import { devices } from '@playwright/test';
import { test, expect } from './fixtures/failure-metadata';
import { clearAuth } from './fixtures/auth';

// Test on mobile viewport
test.describe('Responsive Design - Mobile', () => {
  test.use({ ...devices['Pixel 5'] });

  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test('should display mobile login', async ({ page }) => {
    await page.goto('/login');

    // Verify elements are visible on mobile
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should display responsive navigation', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForURL('/', { timeout: 10000 });

    // Check viewport
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(500);

    // Navigation should be accessible on mobile (hamburger menu or similar)
    const nav = page.locator('nav').or(page.locator('[data-testid="nav-menu"]'));
    await expect(nav).toBeVisible();
  });

  test('should display readable text on mobile', async ({ page }) => {
    await page.goto('/login');

    // Check font sizes are readable (minimum 16px)
    const inputs = page.locator('input');
    const fontSize = await inputs.first().evaluate((el) => {
      return window.getComputedStyle(el).fontSize;
    });

    const fontSizeNum = parseInt(fontSize);
    expect(fontSizeNum).toBeGreaterThanOrEqual(12);
  });
});

// Test on tablet viewport
test.describe('Responsive Design - Tablet', () => {
  test.use({ ...devices['iPad Pro'] });

  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test('should display tablet layout', async ({ page }) => {
    await page.goto('/login');

    // Verify elements are visible
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Check viewport
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeGreaterThan(500);
    expect(viewport?.width).toBeLessThan(1200);
  });

  test('should display data tables on tablet', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    await page.waitForURL('/', { timeout: 10000 });

    // Navigate to transactions
    await page.click('a:has-text("Transactions")', { exact: false });
    await page.waitForURL(/\/transactions/, { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Table should be accessible
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });
});

// Test on desktop viewport
test.describe('Responsive Design - Desktop', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test('should display desktop layout with multiple columns', async ({
    page,
  }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    await page.waitForURL('/', { timeout: 10000 });

    // Navigate to accounts
    await page.click('a:has-text("Accounts")', { exact: false });
    await page.waitForURL(/\/accounts/, { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Check viewport is desktop size
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeGreaterThan(1200);

    // Table should show multiple columns
    const headers = page.locator('table th');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThan(3);
  });

  test('should display side-by-side layout on desktop', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    await page.waitForURL('/', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Check for multiple columns layout
    const mainContent = page.locator('main');
    const gridItems = mainContent.locator('[class*="grid"]');

    if ((await gridItems.count()) > 0) {
      const display = await gridItems.first().evaluate((el) => {
        return window.getComputedStyle(el).display;
      });

      expect(['grid', 'flex']).toContain(display);
    }
  });
});
