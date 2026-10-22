/**
 * Browser failure metadata (issue #456) — coverage
 *
 * Verifies that the failure-metadata fixture surfaces enough context to triage
 * a browser-specific failure: browser build, viewport/user agent, project and
 * retry identity, CI run identifiers, and a readable one-line summary.
 *
 * The fixture attaches its JSON payload automatically when a test fails; these
 * tests call the exported collectors directly so the payload can be asserted
 * without forcing a deliberate failure.
 */

import { test, expect } from './fixtures/failure-metadata';
import {
  attachBrowserFailureMetadata,
  collectBrowserFailureMetadata,
  formatFailureSummary,
} from './fixtures/failure-metadata';

test.describe('Browser failure metadata', () => {
  test('records the live browser identity and environment', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const metadata = await collectBrowserFailureMetadata(testInfo, page);
    const liveBrowser = page.context().browser();

    expect(metadata.browser.name).toBe(liveBrowser?.browserType().name());
    expect(metadata.browser.version).toBe(liveBrowser?.version());
    expect(metadata.environment.viewport).toEqual({ width: 1280, height: 720 });
    expect(metadata.environment.userAgent).toBeTruthy();
    expect(metadata.environment.pageUrl).toBe(page.url());
    expect(metadata.test.project).toBe(testInfo.project.name);
    expect(metadata.test.title).toBe(testInfo.title);
    expect(metadata.test.retry).toBe(testInfo.retry);
    expect(metadata.playwrightVersion).toBe(testInfo.config.version);
    expect(metadata.failure.message).toBeTruthy();
  });

  test('classifies the CI environment', async ({ baseURL }, testInfo) => {
    const metadata = await collectBrowserFailureMetadata(testInfo);

    expect(metadata.environment.baseUrl).toBe(baseURL);

    if (process.env.GITHUB_ACTIONS === 'true') {
      expect(metadata.ci.provider).toBe('github-actions');
      expect(metadata.ci.detected).toBe(true);
      expect(metadata.ci.runId).toBeTruthy();
      expect(metadata.ci.sha).toBeTruthy();
    } else if (process.env.CI) {
      expect(metadata.ci.provider).toBe('generic-ci');
      expect(metadata.ci.detected).toBe(true);
    } else {
      expect(metadata.ci).toMatchObject({
        detected: false,
        provider: 'local',
        runId: null,
        workflow: null,
      });
    }
  });

  test('falls back to project options and attaches a summary', async ({ page }, testInfo) => {
    const metadata = await collectBrowserFailureMetadata(testInfo, page);
    await page.close();

    // A closed page must not break collection — fall back to project options.
    const afterClose = await collectBrowserFailureMetadata(testInfo, page);
    expect(afterClose.browser.version).toBeNull();
    expect(afterClose.browser.name).toBeTruthy();
    expect(afterClose.environment.baseUrl).toBeTruthy();

    // Serialising the payload (what the fixture does on failure) must work.
    await attachBrowserFailureMetadata(testInfo, metadata);

    const summary = formatFailureSummary({
      ...metadata,
      browser: { name: 'firefox', version: '132.0' },
    });
    expect(summary).toContain('firefox 132.0');
    expect(summary).toContain(`project=${metadata.test.project}`);
    expect(summary).toContain(`retry=${metadata.test.retry}`);
  });
});
