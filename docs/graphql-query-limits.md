# GraphQL Query Depth Limiting and Cost Estimation

This document defines the controls designed to prevent expensive, recursive, or malicious GraphQL queries from degrading API and database performance.

---

## Control Enforcement Matrix

> [!IMPORTANT]
> **Implementation Status**: While rate limiting is actively enforced in the primary API server (`api/src/index.ts`), query depth limiting and cost estimation are currently **aspirational controls** staged in architecture designs and `packages/api`. Review the matrix below before relying on these safeguards in production.

| Control | Status | Specification | Enforcement Location | Notes |
|---|---|---|---|---|
| **IP Rate Limiting** | ✅ **Enforced** | 100 req / 60s window | `api/src/rateLimit.ts` | Fixed-window limiter returning HTTP `429` with `RateLimit-*` and `Retry-After` headers; in-memory by default, shared Postgres store via `RATE_LIMIT_STORE=postgres`. See [Rate Limiting](#rate-limiting). |
| **Query Depth Limiting** | ✅ **Enforced** | Max depth: 10 levels | `api/src/depthLimit.ts` | Custom validation rule run on HTTP (GET/POST) and WebSocket operations in `api/src/index.ts`. |
| **Query Complexity Score** | ⚠️ **Aspirational** | Max cost: 1000 points | Staged (`packages/api/src/index.ts`) | Pre-execution AST cost calculation; pending Apollo server pipeline promotion. |
| **`X-Query-Complexity` Header** | ⚠️ **Aspirational** | Telemetry response header | Roadmap | Target feature to enable client-side budget tuning prior to hitting thresholds. |
| **Production Introspection Guard** | ⚠️ **Aspirational** | `introspection: false` in prod | Staged (`packages/api/src/index.ts`) | Introspection is disabled in Apollo configuration; plain GraphQL endpoint in `api/src/index.ts` still resolves introspection queries. |

---

## Depth Limiting

> ✅ **Status: Enforced** in `api/src/index.ts` via the `depthLimit()` rule in `api/src/depthLimit.ts`. Fragments are expanded when measuring depth and introspection fields (`__typename`, `__schema`, …) are ignored.

Depth limiting is applied via the [graphql-depth-limit](https://github.com/stems/graphql-depth-limit) package as a GraphQL validation rule:

```typescript
import depthLimit from 'graphql-depth-limit';

this.apolloServer = new ApolloServer({
  validationRules: [
    depthLimit(10) as any,
  ],
  // ...
});
```

The maximum allowed depth defaults to **10 levels** and is configurable through the `GRAPHQL_MAX_DEPTH` environment variable (`packages/api/src/utils/graphql-depth.ts`):

```ts
validationRules: [depthLimit(resolveMaxQueryDepth()) as any],
```

| `GRAPHQL_MAX_DEPTH` value | Effective depth |
| --- | --- |
| unset / empty | `10` (default) |
| integer `1`–`50` | the configured value |
| `< 1` or `> 50` | clamped to `1` or `50` |
| non-integer (e.g. `abc`, `4.5`) | `10` (default) |

**Operational notes:** the value is read once at server startup, so restart the API to apply a change. Lowering it can reject client queries that worked before, so check the frontend's deepest queries before reducing it in production.

### What Counts as Depth

Each nested selection set adds one level of depth. For example:

```graphql
# Depth: 1
query {
  ledgers {          # 1
    edges {          # 2
      node {         # 3
        sequence     # 4
      }
    }
  }
}
```

A query exceeding depth 10 is rejected before execution with a validation error.

### Error Response (Target Envelope)

When the depth limit rule is activated, queries exceeding the limit will receive a 400-level GraphQL validation failure:

```json
{
  "errors": [
    {
      "message": "'queryName' exceeds maximum operation depth of 10",
      "extensions": {
        "code": "GRAPHQL_VALIDATION_FAILED"
      }
    }
  ]
}
```

---

## Query Cost Estimation

> ⚠️ **Status: Aspirational / In-Progress**
>
> *Query complexity scoring is implemented in `packages/api/src/index.ts:calculateQueryComplexity()` as a design candidate, but is not executed on requests served by the root HTTP server (`api/src/index.ts`). Clients cannot currently trigger complexity rejections.*

In addition to depth limiting, the target architecture calculates a **complexity score** for every incoming query in the `didResolveOperation` Apollo plugin hook — before any resolvers execute. Queries exceeding the configured ceiling will be rejected immediately.

### How Complexity is Calculated

The cost calculation algorithm is defined in `calculateQueryComplexity()` in `packages/api/src/index.ts`:

- Each selected field contributes **1 point** (multiplied by the current list multiplier).
- Fields that resolve to **paginated collections** (`transactions`, `ledgers`, `accounts`, `operations`, `assets`, `edges`, `nodes`, `networkMetrics`, `assetMetrics`) scale the cost by the requested page size (defaults to 10 when no pagination argument is supplied).
- The multiplier accumulates as the query nests deeper into list fields — `accounts { transactions { ... } }` compounds the cost.

### Configuration

| Parameter | Default | Environment Variable | Status |
|-----------|---------|----------------------|---|
| Maximum complexity | `1000` | `MAX_QUERY_COMPLEXITY` | Aspirational target ceiling |

### `X-Query-Complexity` Response Header

> ⚠️ **Status: Aspirational Roadmap Feature**

Once the complexity plugin is promoted to the active request lifecycle, every GraphQL response will include an `X-Query-Complexity` header so API clients can inspect their score and optimize queries before hitting the limit:

```http
X-Query-Complexity: 42
```

### Error Response (Target Envelope)

When a query exceeds the complexity limit, the API will return a `400`-level GraphQL error:

```json
{
  "errors": [
    {
      "message": "Query complexity 1200 exceeds the maximum allowed complexity of 1000. Reduce the number of requested fields or lower the pagination limit.",
      "extensions": {
        "code": "QUERY_TOO_COMPLEX"
      }
    }
  ]
}
```

### Reducing Query Complexity

- Request only the fields you need — unused fields still contribute to the score.
- Lower the `first`/`pagination.first` argument on list fields.
- Avoid deeply nested list-within-list queries (e.g. accounts → transactions → operations).

---

## Adjusting the Depth Limit

The root API (`api/src/depthLimit.ts`) reads `GRAPHQL_MAX_DEPTH` at startup (default `10`). The staged `packages/api` server follows the same convention:

```typescript
const maxDepth = parseInt(process.env.GRAPHQL_MAX_DEPTH || '10', 10);

validationRules: [
  depthLimit(maxDepth) as any,
],
```

Environment variable:

```env
GRAPHQL_MAX_DEPTH=10
```

---

## Rate Limiting

The root API applies a per-client budget of 100 requests per 60-second window to `/graphql` (`api/src/rateLimit.ts`).

### Response Headers

Every `/graphql` response includes:

| Header | Meaning |
|---|---|
| `RateLimit-Limit` | Requests allowed per window |
| `RateLimit-Remaining` | Requests left in the current window |
| `RateLimit-Reset` | Seconds until the window resets |
| `Retry-After` | Only on `429`; seconds to wait before retrying |

### Shared Storage

By default counters live in process memory, so each replica enforces its own budget. Set `RATE_LIMIT_STORE=postgres` to store counters in the `api_rate_limits` table (created automatically on first use) so all replicas share one budget. If Postgres is unavailable the API logs the error and falls back to the in-memory store rather than rejecting traffic. Expired rows are pruned every minute.

### Client IP Resolution

`X-Forwarded-For` is ignored unless `TRUST_PROXY_HOPS` is set to the number of trusted reverse proxies in front of the API. With `TRUST_PROXY_HOPS=N`, the client IP is the `N`th entry from the right of the header; values that are not valid IPv4/IPv6 addresses are discarded and the socket address is used instead. Leave it at `0` when the API is exposed directly, otherwise clients can spoof their address to evade rate limits.

---

## Introspection

> ⚠️ **Status: Partial Enforcement**

Introspection is disabled in Apollo production configuration (`introspection: !isProduction`). However, the lightweight root Express server (`api/src/index.ts`) uses `buildSchema` without introspection filters. Full production hardening requires unifying endpoints under Apollo Server or adding the `NoSchemaIntrospectionCustomRule` validation rule.

---

## Logging Rejected Queries

Rejected queries are designed to be caught by Apollo's `didEncounterErrors` plugin hook and logged via Winston:

```typescript
didEncounterErrors(ctx) {
  logger.error('GraphQL operation errors', {
    operation: ctx.request.operationName,
    errors: ctx.errors,
  });
}
```

Check `logs/error.log` or console output for rejected query details.

---

## Operational Promotion Checklist

To promote aspirational controls into enforced production status:

1. [ ] Install `graphql-depth-limit` into the root `api` package or unify service execution under `packages/api`.
2. [ ] Wire `depthLimit(maxDepth)` into GraphQL execution validation rules.
3. [ ] Register `calculateQueryComplexity` plugin in Apollo Server request lifecycle.
4. [ ] Validate that legitimate frontend queries in `packages/frontend/src/graphql/queries.ts` stay safely below the 1000-point ceiling and 10-depth limit.
5. [ ] Update this document to mark controls as ✅ **Enforced**.
