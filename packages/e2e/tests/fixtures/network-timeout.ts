/**
 * API timeout simulation helpers (issue #453)
 *
 * The dashboard talks to the GraphQL API through Apollo Client, which is
 * configured with a RetryLink (3 attempts, exponential back-off) and
 * `errorPolicy: 'all'` so a failed refresh keeps the last rendered data
 * visible.  Exercising that recovery path against a real API is impractical —
 * you cannot ask Postgres to hang for exactly one request — so these helpers
 * intercept the GraphQL endpoint in the browser and fail requests on cue.
 *
 * Usage:
 *
 *   const api = await GraphQlTimeoutSimulator.install(page);
 *   await page.goto('/');
 *   // ...every GraphQL request now times out
 *   api.allowRequests();          // API "recovers"
 *   await page.unroute(...)       // or api.remove() to stop intercepting
 *
 * `failures` limits how many requests fail, which is how a transient outage
 * is simulated: the retry that Apollo schedules is served by the real API.
 *
 * Note: install the simulator *after* the auth fixture has logged in, or the
 * login mutation will be intercepted too.
 */

import type { Page, Route, Request } from '@playwright/test';

/** Playwright network failure codes that look like an API timeout. */
export type SimulatedFailure =
  'timedout' | 'aborted' | 'connectionresetbypeer' | 'internetdisconnected';

export interface SimulationOptions {
  /**
   * How many matching GraphQL requests fail before requests are allowed
   * through again. Defaults to Infinity (the API stays down until
   * `allowRequests()` / `remove()` is called).
   */
  failures?: number;
  /** Network failure code reported to the browser. Defaults to `timedout`. */
  failure?: SimulatedFailure;
  /**
   * Only intercept requests for this GraphQL operation name, e.g. `'GetStats'`.
   * Defaults to every request sent to the GraphQL endpoint.
   */
  operation?: string;
}

/** Matches `http://localhost:4000/graphql` and query-string variants. */
export const GRAPHQL_URL_PATTERN = /\/graphql(\?.*)?$/;

/** Read the GraphQL operation name from a request body, if it is JSON. */
export function getGraphQlOperationName(request: Request): string | null {
  try {
    const body = request.postDataJSON() as { operationName?: unknown } | null;
    return typeof body?.operationName === 'string' ? body.operationName : null;
  } catch {
    // Subscriptions and malformed bodies are not JSON; they are not part of
    // the HTTP timeout path this helper simulates.
    return null;
  }
}

export class GraphQlTimeoutSimulator {
  /** GraphQL requests seen (matching the optional operation filter). */
  attempts = 0;
  /** GraphQL requests failed by this simulator. */
  failedAttempts = 0;

  private failuresRemaining: number;
  private removed = false;

  private constructor(
    private readonly page: Page,
    private readonly failure: SimulatedFailure,
    private readonly operation: string | undefined,
    failures: number
  ) {
    this.failuresRemaining = failures;
  }

  /**
   * Start intercepting GraphQL requests.  Returns the simulator so specs can
   * inspect counters or let the API recover mid-test.
   */
  static async install(
    page: Page,
    options: SimulationOptions = {}
  ): Promise<GraphQlTimeoutSimulator> {
    const simulator = new GraphQlTimeoutSimulator(
      page,
      options.failure ?? 'timedout',
      options.operation,
      options.failures ?? Number.POSITIVE_INFINITY
    );

    await page.route(GRAPHQL_URL_PATTERN, simulator.handleRoute);
    return simulator;
  }

  private handleRoute = async (route: Route): Promise<void> => {
    if (this.removed) {
      await route.fallback();
      return;
    }

    if (this.operation) {
      const operationName = getGraphQlOperationName(route.request());
      if (operationName !== this.operation) {
        await route.fallback();
        return;
      }
    }

    this.attempts += 1;

    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      this.failedAttempts += 1;
      // Fail at the transport layer, exactly like a request that never gets a
      // response — Apollo's RetryLink treats it as retryable.
      await route.abort(this.failure);
      return;
    }

    await route.fallback();
  };

  /** Simulate the API coming back: let every subsequent request through. */
  allowRequests(): void {
    this.failuresRemaining = 0;
  }

  /** Stop intercepting entirely (also resolves pending matches). */
  async remove(): Promise<void> {
    if (this.removed) return;
    this.removed = true;
    await this.page.unroute(GRAPHQL_URL_PATTERN, this.handleRoute);
  }
}

export default GraphQlTimeoutSimulator;
