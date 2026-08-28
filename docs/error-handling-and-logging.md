# Error Handling and Logging

The API uses [Winston](https://github.com/winstonjs/winston) for structured logging and Apollo Server's plugin system for GraphQL-level error tracking.

## Logging

### Configuration

The logger is initialized in `packages/api/src/index.ts`:

```typescript
this.logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});
```

### Log Levels

Controlled by the `LOG_LEVEL` environment variable. Valid values (in order of verbosity):

| Level | Usage |
|-------|-------|
| `error` | Unhandled errors, startup failures, GraphQL errors |
| `warn` | Slow queries (>1000ms), WebSocket errors, rate limit hits |
| `info` | Server startup, DB connection, GraphQL operations, WS connect/disconnect |
| `debug` | Verbose request details (not enabled by default) |

### Log Files

| File | Contents |
|------|----------|
| `logs/error.log` | Error-level messages only |
| `logs/combined.log` | All log levels |

Console output uses colorized simple format for readability in development. File output uses JSON format for structured log ingestion.

### Environment Variable

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Minimum log level to emit |

## GraphQL Error Handling

Apollo Server plugins handle three lifecycle events:

### Operation Resolved

Logged at `info` level when a GraphQL operation successfully resolves:

```
GraphQL operation resolved { operation, userId, variables }
```

### Errors Encountered

Logged at `error` level when a GraphQL operation encounters errors:

```
GraphQL operation errors { operation, errors }
```

This covers both validation errors (e.g. depth limit exceeded) and resolver errors.

### Slow Query Detection

Logged at `warn` level when a GraphQL operation takes longer than 1000ms:

```
Slow GraphQL query detected { operation, duration }
```

## Error Classification and User-Friendly Messages (issue #340)

All GraphQL errors are processed by the `formatGraphQLError` hook before being sent to clients.
Each error is enriched with two additional `extensions` fields:

| Field | Description |
|-------|-------------|
| `code` | Stable error category (see table below) |
| `userMessage` | Short, non-technical message safe to display in the UI |

### Error Codes

| Code | Meaning | HTTP equivalent |
|------|---------|-----------------|
| `INTERNAL_ERROR` | Unexpected server failure | 500 |
| `NOT_FOUND` | Requested resource does not exist | 404 |
| `UNAUTHENTICATED` | Request requires a valid login | 401 |
| `FORBIDDEN` | Authenticated user lacks permission | 403 |
| `VALIDATION_ERROR` | GraphQL schema or query validation failed | 400 |
| `BAD_USER_INPUT` | Mutation/query argument is invalid | 400 |
| `RATE_LIMITED` | Client exceeded the request rate limit | 429 |
| `SERVICE_UNAVAILABLE` | Upstream service (Horizon) is temporarily down | 503 |
| `TIMEOUT` | Operation exceeded its time budget | 504 |
| `QUERY_TOO_COMPLEX` | Query depth/complexity limit exceeded | 400 |
| `PERSISTED_QUERY_NOT_FOUND` | APQ hash not in cache | 200 (APQ re-send) |

### Behaviour by environment

| Environment | `message` field | `extensions.internalMessage` |
|-------------|----------------|------------------------------|
| Development | Original technical message | Present when it differs from `message` |
| Production | `userMessage` (safe copy) | Absent |

Sensitive fields (`stacktrace`, `exception`) are **always** stripped from client responses in both environments.

### Frontend usage

The `useApiError` hook (`packages/frontend/src/hooks/useApiError.ts`) extracts the `userMessage`
and `code` from Apollo errors and exposes convenience flags:

```typescript
const { message, code, isUnauthenticated, isNotFound, isValidation, isServerError } =
  useApiError(apolloError);
```

The `ApiErrorMessage` component (`packages/frontend/src/components/ApiErrorMessage.tsx`) renders
a classified error with an appropriate icon, colour, and optional "Try again" button:

```tsx
if (error) return <ApiErrorMessage error={error} onRetry={refetch} />;
```

## HTTP Error Handling

### Health Endpoint

`GET /health` returns structured JSON with database status. On failure it returns HTTP 503:

```json
{
  "status": "unhealthy",
  "timestamp": "2026-05-28T00:00:00.000Z",
  "error": "connection refused"
}
```

### Rate Limiting

When a client exceeds 1000 requests/minute, the rate limiter returns HTTP 429:

```json
{
  "error": "Too many requests from this IP, please try again later."
}
```

Rate limiting keys on the authenticated user ID when a valid JWT is present, falling back to IP address.

## WebSocket Error Handling

WebSocket errors are logged at `warn` level:

```
WebSocket error { ip, errors }
```

Subscription rate limit violations throw an error that closes the WebSocket connection with a descriptive message.

## Startup Validation

On startup, the server validates required environment variables before attempting to connect to the database:

```typescript
private validateEnvironment(): void {
  const requiredEnvVars = ['DATABASE_URL', 'REDIS_URL'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}
```

If validation fails, the process exits with code 1 and logs the missing variables.

## Graceful Shutdown

The server handles `SIGTERM` and `SIGINT` signals, shutting down in order:

1. Stop the realtime publisher
2. Stop Apollo Server
3. Disconnect from the database
4. Close the HTTP server

Errors during shutdown are logged and the process exits with code 1.

## Production Considerations

- Set `LOG_LEVEL=warn` or `LOG_LEVEL=error` in production to reduce log volume.
- Ship `logs/combined.log` and `logs/error.log` to a log aggregation service (e.g. CloudWatch, Datadog, Loki).
- Apollo Server's landing page (GraphQL Playground) is automatically disabled when `NODE_ENV=production`.
- Error messages from resolvers are returned as-is to clients. Avoid including internal details (stack traces, SQL queries, file paths) in `GraphQLError` messages thrown from resolvers.
