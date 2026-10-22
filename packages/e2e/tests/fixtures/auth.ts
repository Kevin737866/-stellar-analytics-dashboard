import { Page } from '@playwright/test';
// Extends the browser failure-metadata fixture so every authenticated test
// automatically attaches environment details when it fails (issue #456).
import { test as base, expect } from './failure-metadata';

/**
 * Fixture for authenticated user context
 */
export type AuthFixtures = {
  authenticatedPage: Page;
  testUserEmail: string;
  testUserPassword: string;
};

export const test = base.extend<AuthFixtures>({
  testUserEmail: 'test@example.com',
  testUserPassword: 'TestPassword123!',

  authenticatedPage: async ({ page, testUserEmail, testUserPassword }, use) => {
    // Navigate to login page
    await page.goto('/login');

    // Check if already logged in (e.g., token in localStorage)
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    if (!token) {
      // Perform login
      await page.fill('input[type="email"]', testUserEmail);
      await page.fill('input[type="password"]', testUserPassword);
      await page.click('button[type="submit"]');

      // Wait for successful login - either navigate to dashboard or show error
      await page.waitForURL('/', { timeout: 5000 }).catch(() => {
        // If navigation fails, try alternate path
        return page.waitForLoadState('networkidle');
      });
    }

    await use(page);

    // Cleanup: logout
    try {
      // Click user menu if available
      await page.click('[data-testid="user-menu"]').catch(() => null);
      // Click logout button if available
      await page.click('[data-testid="logout-button"]').catch(() => null);
    } catch {
      // Ignore logout errors
    }
  },
});

export { expect };

/**
 * Helper function to manually login via GraphQL
 */
export async function loginViaGraphQL(
  page: Page,
  email: string,
  password: string
) {
  const response = await page.evaluate(
    async ({ email, password }) => {
      const query = `
        mutation Login($email: String!, $password: String!) {
          login(email: $email, password: $password) {
            token
            user {
              id
              email
              name
              role
            }
          }
        }
      `;

      const result = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { email, password },
        }),
      });

      return await result.json();
    },
    { email, password }
  );

  if (response.data?.login?.token) {
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, response.data.login.token);
    return response.data.login;
  } else {
    throw new Error(`Login failed: ${response.errors?.[0]?.message}`);
  }
}

/**
 * Helper function to clear authentication
 */
export async function clearAuth(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
  });
}
