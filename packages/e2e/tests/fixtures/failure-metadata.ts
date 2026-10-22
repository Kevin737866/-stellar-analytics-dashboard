/**
 * Browser failure metadata (issue #456)
 *
 * When a test fails, the Playwright report tells you *what* assertion broke but
 * rarely *which* browser environment produced it.  Failures that only reproduce
 * in one browser, viewport or CI runner are expensive to triage without that
 * context.
 *
 * This module adds an automatic fixture that, for every failed attempt,
 * attaches a `browser-failure-metadata.json` file containing:
 *
 *   - the browser engine, version and project/device used for the run
 *   - viewport, user agent, locale, timezone, colour scheme and base URL
 *   - the Playwright / Node / platform versions
 *   - the test location, retry and worker indexes
 *   - GitHub Actions run identifiers when running in CI
 *   - the failure message and a truncated stack trace
 *
 * The attachment lands in `test-results/<test>/` next to the screenshot,
 * video and trace, so it is uploaded with the existing CI artifacts and shown
 * in the HTML report under the "Attachments" tab.
 *
 * Usage — import `test`/`expect` from this module (or from `./auth`, which
 * extends this fixture) instead of `@playwright/test`:
 *
 *   import { test, expect } from './fixtures/failure-metadata';
 *
 * The fixture is transparent: it performs no setup on passing tests.
 */

import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FailureMetadataCiContext {
  /** True when a CI environment variable is present. */
  detected: boolean;
  provider: 'github-actions' | 'generic-ci' | 'local';
  workflow: string | null;
  runId: string | null;
  runAttempt: string | null;
  job: string | null;
  sha: string | null;
  ref: string | null;
  eventName: string | null;
  actor: string | null;
}

export interface FailureMetadataBrowser {
  /** chromium | firefox | webkit, as reported by the running browser. */
  name: string;
  /** Exact browser build, when a live page was available. */
  version: string | null;
}

export interface FailureMetadataEnvironment {
  baseUrl: string | null;
  pageUrl: string | null;
  viewport: { width: number; height: number } | null;
  deviceScaleFactor: number | null;
  isMobile: boolean | null;
  hasTouch: boolean | null;
  locale: string | null;
  timezoneId: string | null;
  colorScheme: string | null;
  userAgent: string | null;
}

export interface FailureMetadataTest {
  title: string;
  fullTitle: string;
  file: string | null;
  line: number | null;
  column: number | null;
  project: string;
  retry: number;
  repeatEachIndex: number;
  workerIndex: number;
  parallelIndex: number;
  status: string;
  expectedStatus: string;
  durationMs: number;
}

export interface BrowserFailureMetadata {
  generatedAt: string;
  playwrightVersion: string;
  node: {
    version: string;
    platform: string;
    arch: string;
  };
  test: FailureMetadataTest;
  browser: FailureMetadataBrowser;
  environment: FailureMetadataEnvironment;
  ci: FailureMetadataCiContext;
  failure: {
    message: string;
    stack: string | null;
  };
}

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

/** Read an environment variable as a string or null. */
function env(name: string): string | null {
  const value = process.env[name];
  return value && value.length > 0 ? value : null;
}

function collectCiContext(): FailureMetadataCiContext {
  const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
  const detected = Boolean(process.env.CI) || isGithubActions;

  return {
    detected,
    provider: isGithubActions ? 'github-actions' : detected ? 'generic-ci' : 'local',
    workflow: env('GITHUB_WORKFLOW'),
    runId: env('GITHUB_RUN_ID'),
    runAttempt: env('GITHUB_RUN_ATTEMPT'),
    job: env('GITHUB_JOB'),
    sha: env('GITHUB_SHA'),
    ref: env('GITHUB_REF_NAME') ?? env('GITHUB_REF'),
    eventName: env('GITHUB_EVENT_NAME'),
    actor: env('GITHUB_ACTOR'),
  };
}

function truncate(value: string | undefined, maxLength = 4000): string | null {
  if (!value) return null;
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

/**
 * Build the failure metadata payload for a test.
 *
 * The `page` argument is optional: when a live page is available we read the
 * real browser build, viewport and user agent.  When it is not (page fixture
 * failed, page already closed) we fall back to the resolved project options so
 * the report is still useful.
 */
export async function collectBrowserFailureMetadata(
  testInfo: TestInfo,
  page?: Page
): Promise<BrowserFailureMetadata> {
  const options = testInfo.project.use;

  let browserName = options.defaultBrowserType ?? testInfo.project.name;
  let browserVersion: string | null = null;
  let viewport = options.viewport ?? null;
  let userAgent = typeof options.userAgent === 'string' ? options.userAgent : null;
  let pageUrl: string | null = null;

  if (page && !page.isClosed()) {
    try {
      const browser = page.context().browser();
      if (browser) {
        browserName = browser.browserType().name();
        browserVersion = browser.version();
      }
      viewport = page.viewportSize();
      userAgent = await page.evaluate(() => navigator.userAgent);
      pageUrl = page.url();
    } catch {
      // The page can disappear between the failure and this collection
      // (crash, timeout teardown).  Keep the project-level fallbacks.
    }
  }

  const error = testInfo.error;

  return {
    generatedAt: new Date().toISOString(),
    playwrightVersion: testInfo.config.version,
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    test: {
      title: testInfo.title,
      fullTitle: testInfo.titlePath.join(' > '),
      file: testInfo.file ?? null,
      line: testInfo.line ?? null,
      column: testInfo.column ?? null,
      project: testInfo.project.name,
      retry: testInfo.retry,
      repeatEachIndex: testInfo.repeatEachIndex,
      workerIndex: testInfo.workerIndex,
      parallelIndex: testInfo.parallelIndex,
      status: testInfo.status ?? 'unknown',
      expectedStatus: testInfo.expectedStatus,
      durationMs: testInfo.duration,
    },
    browser: {
      name: browserName,
      version: browserVersion,
    },
    environment: {
      baseUrl: options.baseURL ?? env('BASE_URL'),
      pageUrl,
      viewport,
      deviceScaleFactor: options.deviceScaleFactor ?? null,
      isMobile: options.isMobile ?? null,
      hasTouch: options.hasTouch ?? null,
      locale: options.locale ?? null,
      timezoneId: options.timezoneId ?? null,
      colorScheme: options.colorScheme ?? null,
      userAgent,
    },
    ci: collectCiContext(),
    failure: {
      message: error?.message ?? 'Unknown failure (no error recorded by Playwright)',
      stack: truncate(error?.stack),
    },
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** One-line summary written to the CI log next to the attachment. */
export function formatFailureSummary(metadata: BrowserFailureMetadata): string {
  const { browser, environment, test, ci } = metadata;
  const browserLabel = browser.version ? `${browser.name} ${browser.version}` : browser.name;
  const viewport = environment.viewport
    ? `${environment.viewport.width}x${environment.viewport.height}`
    : 'unknown viewport';
  const runLabel = ci.runId ? ` (run ${ci.runId}#${ci.runAttempt ?? '1'})` : '';

  return [
    `browser-failure-metadata: ${browserLabel}`,
    `project=${test.project}`,
    `viewport=${viewport}`,
    `retry=${test.retry}`,
    `url=${environment.pageUrl ?? environment.baseUrl ?? 'n/a'}`,
    `ci=${ci.provider}${runLabel}`,
  ].join(' ');
}

/**
 * Attach the metadata to the test result.  Exported separately so tests can
 * exercise the serialisation without forcing a test failure.
 *
 * The payload is written to the test's output directory first so it is a real
 * file in `test-results/` — that is what the CI artefact upload picks up, and
 * it survives even when the HTML report is not opened.
 */
export async function attachBrowserFailureMetadata(
  testInfo: TestInfo,
  metadata: BrowserFailureMetadata
): Promise<void> {
  const fileName = 'browser-failure-metadata.json';
  const filePath = testInfo.outputPath(fileName);
  await fs.promises.writeFile(filePath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  await testInfo.attach(fileName, {
    contentType: 'application/json',
    path: filePath,
  });

  // Also surface the key facts in the raw CI log, where reviewers land first.
  console.log(`[failure-metadata] ${formatFailureSummary(metadata)}`);
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

export const test = base.extend<{
  /** Automatic fixture that captures browser context for failed tests. */
  _browserFailureMetadata: void;
}>({
  _browserFailureMetadata: [
    async ({ page }, use, testInfo): Promise<void> => {
      await use();

      const failed =
        testInfo.status === 'failed' ||
        testInfo.status === 'timedOut' ||
        testInfo.status === 'interrupted';

      if (!failed) return;

      const metadata = await collectBrowserFailureMetadata(testInfo, page);
      await attachBrowserFailureMetadata(testInfo, metadata);
    },
    { auto: true },
  ],
});

export { expect };
