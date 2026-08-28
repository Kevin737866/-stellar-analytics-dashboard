import dotenv from 'dotenv';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { ApolloServerPluginLandingPageDisabled } from 'apollo-server-core';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import depthLimit from 'graphql-depth-limit';

import { typeDefs } from './schema/typeDefs';
import { resolvers } from './resolvers';
import { db } from './database/connection';
import { createLoaders } from './loaders';
import { formatQueryMetricsPrometheus, getQueryMetrics } from './database/query-monitor';
import type { HealthCheckResult } from './database/connection';
import { RealtimePublisher } from './services/realtime-publisher';
import { checkSubscriptionRateLimit, checkEventRateLimit, cleanupRateLimits } from './pubsub';
import { authService } from './services/auth';
import { initPerfAlerting, getPerfAlerting } from './services/performance-alerting';
import { mountAdminGraphQL } from './admin/server';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: API_VERSION } = require('../package.json');
import { getDbCircuitBreaker } from './services/circuit-breaker';
import { AuthDirective } from './directives/auth';
import {
  type TraceContext,
  createTraceContext,
  logTrace,
  extractTraceId,
  getTraceResponseHeader,
} from './utils/tracer';
import { formatGraphQLError, QueryTooComplexError } from './utils/resolver-error';
import { verify } from 'jsonwebtoken';

dotenv.config();

// Bumped only on a breaking change to the public GraphQL schema or REST
// endpoints. See docs/api-versioning.md for the full policy.
const API_CONTRACT_VERSION = 'v1';

const MAX_QUERY_COMPLEXITY = 1000;

// List field names that resolve to paginated collections — cost scaled by requested size
const LIST_FIELD_NAMES = new Set([
  'transactions',
  'ledgers',
  'accounts',
  'operations',
  'assets',
  'edges',
  'nodes',
  'networkMetrics',
  'assetMetrics',
]);

function timeoutMiddleware(timeoutMs: number, logger: winston.Logger) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        logger.error('Request timeout reached', {
          path: req.path,
          method: req.method,
          ip: req.ip,
          timeoutMs,
        });
        res.status(503).json({
          error: 'Request timeout',
          message: `The request took too long to process and was timed out after ${timeoutMs}ms`,
        });
      }
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
}

function calculateQueryComplexity(document: any, variables?: Record<string, any>): number {
  let complexity = 0;

  function scoreSelections(selections: any[], multiplier: number): void {
    for (const selection of selections) {
      if (selection.kind !== 'Field') continue;

      const fieldName: string = selection.name.value;
      if (fieldName.startsWith('__')) continue;

      let fieldMultiplier = multiplier;

      if (LIST_FIELD_NAMES.has(fieldName)) {
        let listSize = 10;

        const paginationArg = selection.arguments?.find((a: any) => a.name.value === 'pagination');
        if (paginationArg?.value?.fields) {
          const firstField = paginationArg.value.fields.find((f: any) => f.name.value === 'first');
          if (firstField?.value?.kind === 'IntValue') {
            listSize = parseInt(firstField.value.value, 10);
          } else if (firstField?.value?.kind === 'Variable' && variables) {
            const v = variables[firstField.value.name.value];
            if (typeof v === 'number') listSize = v;
          }
        }

        const firstArg = selection.arguments?.find((a: any) => a.name.value === 'first');
        if (firstArg?.value?.kind === 'IntValue') {
          listSize = parseInt(firstArg.value.value, 10);
        } else if (firstArg?.value?.kind === 'Variable' && variables) {
          const v = variables[firstArg.value.name.value];
          if (typeof v === 'number') listSize = v;
        }

        fieldMultiplier = multiplier * Math.max(1, listSize);
      }

      complexity += fieldMultiplier;

      if (selection.selectionSet?.selections) {
        scoreSelections(selection.selectionSet.selections, fieldMultiplier);
      }
    }
  }

  for (const def of document.definitions ?? []) {
    if (def.kind === 'OperationDefinition' && def.selectionSet?.selections) {
      scoreSelections(def.selectionSet.selections, 1);
    }
  }

  return complexity;
}

class ApiServer {
  private apolloServer!: ApolloServer;
  private app: express.Application;
  private httpServer: any;
  private logger!: winston.Logger;
  private realtimePublisher: RealtimePublisher;

  constructor() {
    this.app = express();
    this.setupLogger();
    this.setupMiddleware();
    this.setupApolloServer();
    this.realtimePublisher = new RealtimePublisher(3000);
  }

  private setupLogger(): void {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        }),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
      ],
    });
  }

  private setupMiddleware(): void {
    this.app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      })
    );

    this.app.use(
      cors({
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
      })
    );

    this.app.use(compression());

    // ── API version header ────────────────────────────────────────────────────
    // See docs/api-versioning.md — API_CONTRACT_VERSION only bumps on a
    // breaking change to the public schema/REST contract; API_VERSION is the
    // package release version (see docs/versioning.md).
    this.app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.setHeader('X-API-Version', API_CONTRACT_VERSION);
      res.setHeader('X-API-Release', API_VERSION);
      next();
    });

    this.app.get('/version', (_req, res) => {
      res.status(200).json({
        apiVersion: API_CONTRACT_VERSION,
        release: API_VERSION,
      });
    });

    // ── Request Timeout ────────────────────────────────────────────────────────────
    this.app.use(timeoutMiddleware(30000, this.logger));

    // ── HTTP performance tracking middleware ──────────────────────────────────────
    this.app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        getPerfAlerting()?.onHttpRequest(req.method, req.path, res.statusCode, Date.now() - start);
      });
      next();
    });

    // ── Rate limiting ─────────────────────────────────────────────────────────
    //
    // Three tiers, applied in order. The first limiter that matches a request
    // key is the one that counts against it.
    //
    // Tier 1 – API key clients  (x-api-key header present)
    //   Lower ceiling than JWT users because API keys are long-lived credentials
    //   that may be shared or scripted. Keyed on the raw API key value so each
    //   key has its own independent bucket.
    //
    // Tier 2 – Authenticated JWT users  (Bearer token present and valid)
    //   Higher ceiling than anonymous callers. Keyed on user ID so the limit
    //   follows the user regardless of IP.
    //
    // Tier 3 – Anonymous / IP fallback
    //   Lowest ceiling. Keyed on IP address.

    const ADMIN_WINDOW_MS = parseInt(process.env.RATE_LIMIT_ADMIN_WINDOW_MS || '60000', 10);
    const ADMIN_MAX = parseInt(process.env.RATE_LIMIT_ADMIN_MAX || '2000', 10);
    const API_KEY_WINDOW_MS = parseInt(process.env.RATE_LIMIT_API_KEY_WINDOW_MS || '60000', 10);
    const API_KEY_MAX = parseInt(process.env.RATE_LIMIT_API_KEY_MAX || '300', 10);
    const JWT_USER_WINDOW_MS = parseInt(process.env.RATE_LIMIT_JWT_USER_WINDOW_MS || '60000', 10);
    const JWT_USER_MAX = parseInt(process.env.RATE_LIMIT_JWT_USER_MAX || '1000', 10);
    const ANON_WINDOW_MS = parseInt(process.env.RATE_LIMIT_ANON_WINDOW_MS || '60000', 10);
    const ANON_MAX = parseInt(process.env.RATE_LIMIT_ANON_MAX || '100', 10);

    // Tier 1 - Admin user limiter
    const adminLimiter = rateLimit({
      windowMs: ADMIN_WINDOW_MS,
      max: ADMIN_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        const token = authService.extractToken(req.headers.authorization);
        if (!token) return true;
        const payload = authService.verifyToken(token);
        return !payload || payload.role !== 'admin';
      },
      keyGenerator: (req) => {
        const token = authService.extractToken(req.headers.authorization);
        if (token) {
          const payload = authService.verifyToken(token);
          if (payload) return `admin:${payload.userId}`;
        }
        return req.ip || req.socket.remoteAddress || 'unknown';
      },
      message: {
        error: 'Admin rate limit exceeded. Please reduce your request rate.',
      },
      handler: (req, res, next, options) => {
        const token = authService.extractToken(req.headers.authorization);
        const payload = token ? authService.verifyToken(token) : null;
        this.logger.warn('Admin rate limit exceeded', {
          userId: payload?.userId ?? 'unknown',
          ip: req.ip,
          limit: options.max,
          windowMs: options.windowMs,
        });
        res.status(429).json(options.message);
      },
    });

    // Tier 2 – API key limiter
    const apiKeyLimiter = rateLimit({
      windowMs: API_KEY_WINDOW_MS,
      max: API_KEY_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      // Skip requests that are NOT using an API key — let the next limiter handle them
      skip: (req) => {
        const apiKey = req.headers['x-api-key'] as string | undefined;
        return !apiKey || !authService.validateApiKey(apiKey);
      },
      keyGenerator: (req) => {
        // Key on the API key itself so each issued key has its own bucket
        return `apikey:${req.headers['x-api-key']}`;
      },
      message: {
        error:
          'API key rate limit exceeded. Please reduce your request rate or contact support to increase your quota.',
      },
      handler: (req, res, next, options) => {
        this.logger.warn('API key rate limit exceeded', {
          apiKey: (req.headers['x-api-key'] as string)?.substring(0, 12) + '…',
          ip: req.ip,
          limit: options.max,
          windowMs: options.windowMs,
        });
        res.status(429).json(options.message);
      },
    });

    // Tier 3 – JWT user limiter
    const jwtUserLimiter = rateLimit({
      windowMs: JWT_USER_WINDOW_MS,
      max: JWT_USER_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      // Skip API key requests (already handled above) and anonymous requests
      skip: (req) => {
        const apiKey = req.headers['x-api-key'] as string | undefined;
        if (apiKey && authService.validateApiKey(apiKey)) return true;
        const token = authService.extractToken(req.headers.authorization);
        if (!token) return true;
        return !authService.verifyToken(token);
      },
      keyGenerator: (req) => {
        const token = authService.extractToken(req.headers.authorization);
        if (token) {
          const payload = authService.verifyToken(token);
          if (payload) return `user:${payload.userId}`;
        }
        return req.ip || req.socket.remoteAddress || 'unknown';
      },
      message: {
        error: 'Too many requests. Please slow down and try again later.',
      },
      handler: (req, res, next, options) => {
        const token = authService.extractToken(req.headers.authorization);
        const payload = token ? authService.verifyToken(token) : null;
        this.logger.warn('JWT user rate limit exceeded', {
          userId: payload?.userId ?? 'unknown',
          ip: req.ip,
          limit: options.max,
          windowMs: options.windowMs,
        });
        res.status(429).json(options.message);
      },
    });

    // Tier 4 – Anonymous / IP fallback limiter
    const anonLimiter = rateLimit({
      windowMs: ANON_WINDOW_MS,
      max: ANON_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      // Skip authenticated requests — they are handled by the tiers above
      skip: (req) => {
        const apiKey = req.headers['x-api-key'] as string | undefined;
        if (apiKey && authService.validateApiKey(apiKey)) return true;
        const token = authService.extractToken(req.headers.authorization);
        if (token && authService.verifyToken(token)) return true;
        return false;
      },
      keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
      message: {
        error: 'Too many requests from this IP, please try again later.',
      },
      handler: (req, res, next, options) => {
        this.logger.warn('Anonymous rate limit exceeded', {
          ip: req.ip,
          limit: options.max,
          windowMs: options.windowMs,
        });
        res.status(429).json(options.message);
      },
    });

    // Apply all four limiters to the GraphQL endpoint
    this.app.use('/graphql', adminLimiter, apiKeyLimiter, jwtUserLimiter, anonLimiter);

    this.app.get('/health/live', (_req, res) => {
      res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
    });

    this.app.get('/health/ready', async (_req, res) => {
      try {
        const health: HealthCheckResult = await db.healthCheck();
        const pgDown = health.postgres.status === 'error';
        const redisDown = health.redis.status === 'error';

        if (pgDown || redisDown) {
          return res.status(503).json({
            status: 'not_ready',
            postgres: health.postgres.status,
            redis: health.redis.status,
            timestamp: new Date().toISOString(),
          });
        }

        res.status(200).json({
          status: 'ready',
          postgres: health.postgres.status,
          redis: health.redis.status,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        res.status(503).json({
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          error: error?.message ?? 'Readiness check failed',
        });
      }
    });

    this.app.get('/health', async (_req, res) => {
      try {
        const health: HealthCheckResult = await db.healthCheck();
        const statusCode =
          health.status === 'unhealthy' ? 503 : health.status === 'degraded' ? 200 : 200;
        res.status(statusCode).json(health);
      } catch (error: any) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error?.message ?? 'Health check failed',
        });
      }
    });

    this.app.get('/metrics', (_req, res) => {
      res.set('Content-Type', 'text/plain');
      res.send(
        [
          '# HELP graphql_server_status Status of the GraphQL server',
          '# TYPE graphql_server_status gauge',
          'graphql_server_status 1',
          formatQueryMetricsPrometheus(),
        ].join('\n')
      );
    });

    this.app.get('/metrics/queries', (_req, res) => {
      res.json(getQueryMetrics());
    });

    // Issue #216 – Circuit breaker health endpoint
    this.app.get('/health/circuit-breaker', (_req, res) => {
      const cb = getDbCircuitBreaker(this.logger);
      res.json({
        db: cb.getStats(),
        timestamp: new Date().toISOString(),
      });
    });

    // Issue #214 – Bulk data export REST endpoint
    this.app.get('/api/export/:entityType', async (req, res) => {
      try {
        const { entityType } = req.params;
        const format = (req.query.format as string) || 'json';
        const startTime = req.query.startTime as string | undefined;
        const endTime = req.query.endTime as string | undefined;

        if (!['transactions', 'ledgers', 'operations'].includes(entityType)) {
          res.status(400).json({ error: 'Invalid entity type. Must be transactions, ledgers, or operations.' });
          return;
        }

        if (!['json', 'csv'].includes(format)) {
          res.status(400).json({ error: 'Invalid format. Must be json or csv.' });
          return;
        }

        let whereClause = 'WHERE 1=1';
        const params: unknown[] = [];
        let paramIndex = 1;

        if (startTime) {
          whereClause += ` AND created_at >= $${paramIndex++}`;
          params.push(startTime);
        }
        if (endTime) {
          whereClause += ` AND created_at <= $${paramIndex++}`;
          params.push(endTime);
        }

        let query = '';
        switch (entityType) {
          case 'transactions':
            query = `
              SELECT hash, ledger_sequence, successful, fee_charged, operation_count,
                     source_account, created_at, memo_type, memo
              FROM transactions ${whereClause}
              ORDER BY created_at DESC
              LIMIT 10000
            `;
            break;
          case 'ledgers':
            query = `
              SELECT sequence, successful_transaction_count, failed_transaction_count,
                     operation_count, closed_at, base_fee_in_stroops, protocol_version
              FROM ledgers ${whereClause}
              ORDER BY sequence DESC
              LIMIT 10000
            `;
            break;
          case 'operations':
            query = `
              SELECT id, transaction_hash, type, source_account, ledger_sequence,
                     operation_index, details, created_at
              FROM operations ${whereClause}
              ORDER BY created_at DESC
              LIMIT 10000
            `;
            break;
        }

        const rows = await db.query(query, params);

        if (format === 'csv') {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${entityType}_export.csv"`);
          if (rows.length === 0) {
            res.send('');
            return;
          }
          const headers = Object.keys(rows[0]);
          const csvLines = [headers.join(',')];
          for (const row of rows) {
            const values = headers.map((h) => {
              const val = row[h];
              const str = val === null || val === undefined ? '' : String(val);
              return str.includes(',') || str.includes('"') || str.includes('\n')
                ? `"${str.replace(/"/g, '""')}"`
                : str;
            });
            csvLines.push(values.join(','));
          }
          res.send(csvLines.join('\n'));
        } else {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="${entityType}_export.json"`);
          res.json(rows);
        }
      } catch (error: any) {
        this.logger.error('Export endpoint error', { error: error?.message });
        res.status(500).json({ error: 'Export failed', message: error?.message });
      }
    });
  }

  private setupApolloServer(): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const logger = this.logger;

    const plugins: any[] = [
      {
        requestDidStart(requestContext: any) {
          const startTime = Date.now();
          const trace: TraceContext = requestContext.context?.trace;
          
          // Set trace ID as response header for distributed tracing
          if (trace && requestContext.response?.http) {
            requestContext.response.http.headers.set(
              getTraceResponseHeader(),
              trace.requestId
            );
          }
          
          return {
            didResolveOperation(ctx: any) {
              const operation = ctx.request.operationName || 'anonymous';
              const user = ctx.context.user;
              const userId = user ? user.id : 'anonymous';
              
              // Update trace context with operation name
              if (trace) {
                trace.operationName = operation;
              }

              // Calculate query complexity now that the document is available
              const complexity = calculateQueryComplexity(
                ctx.document,
                ctx.request.variables,
              );
              
              logger.info('GraphQL operation resolved', {
                operation,
                userId,
                traceId: trace?.requestId,
                complexity,
                variables: ctx.request.variables,
              });

              if (complexity > MAX_QUERY_COMPLEXITY) {
                throw new QueryTooComplexError(
                  `Query complexity ${complexity} exceeds the maximum allowed complexity of ${MAX_QUERY_COMPLEXITY}. ` +
                    `Reduce the number of requested fields or lower the pagination limit.`
                );
              }

              // Attach complexity to context so willSendResponse can add header
              ctx.context._queryComplexity = complexity;
            },
            didEncounterErrors(ctx: any) {
              logger.error('GraphQL operation errors', {
                operation: ctx.request.operationName,
                traceId: trace?.requestId,
                errors: ctx.errors,
              });
            },
            willSendResponse(ctx: any) {
              const duration = Date.now() - startTime;
              const operation = ctx.request.operationName || 'anonymous';
              const user = ctx.context?.user;
              const userId = user ? user.id : 'anonymous';
              const userRole = user ? user.role : 'anonymous';
              const complexity = ctx.context?._queryComplexity ?? 0;
              const req = ctx.context?.req;
              const clientIp = req?.ip ?? req?.socket?.remoteAddress ?? 'unknown';
              const userAgent = req?.headers?.['user-agent'] ?? 'unknown';
              const apiKey = req?.headers?.['x-api-key']
                ? (req.headers['x-api-key'] as string).substring(0, 12) + '…'
                : undefined;

              // Attach X-Query-Complexity response header
              if (ctx.response?.http) {
                ctx.response.http.headers.set('X-Query-Complexity', String(complexity));
              }

              // Structured request log — one entry per completed GraphQL operation
              logger.info('GraphQL request completed', {
                operation,
                durationMs: duration,
                userId,
                userRole,
                complexity,
                clientIp,
                userAgent,
                ...(apiKey ? { apiKey } : {}),
                traceId: trace?.requestId,
                hasErrors: Boolean(ctx.errors?.length),
              });

              // Log trace summary for every request
              if (trace) {
                logTrace(trace, logger);
              }
              
              if (duration > 1000) {
                logger.warn('Slow GraphQL query detected', {
                  operation,
                  traceId: trace?.requestId,
                  durationMs: duration,
                  complexity,
                  userId,
                });
              }
            },
          };
        },
      },
    ];

    if (isProduction) {
      plugins.push(ApolloServerPluginLandingPageDisabled());
    }

    this.apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      schemaDirectives: {
        auth: AuthDirective,
      },
      context: ({ req }) => {
        let user = null;
        const token = authService.extractToken(req.headers.authorization);
        if (token) {
          const payload = authService.verifyToken(token);
          if (payload) {
            user = {
              id: payload.userId,
              email: payload.email,
              role: payload.role,
            };
          } else {
            const apiKey = req.headers['x-api-key'] as string;
            if (apiKey && authService.validateApiKey(apiKey)) {
              user = { id: 'api-user', email: 'api@stellar-analytics', role: 'user' };
            }
          }
        } else {
          const apiKey = req.headers['x-api-key'] as string;
          if (apiKey && authService.validateApiKey(apiKey)) {
            user = { id: 'api-user', email: 'api@stellar-analytics', role: 'user' };
          }
        }

        // Create trace context for this request
        const incomingTraceId = extractTraceId(req.headers as Record<string, string | string[] | undefined>);
        const trace = createTraceContext(incomingTraceId, user?.id, undefined);

        return {
          req,
          user,
          db,
          loaders: createLoaders(),
          logger: this.logger,
          trace,
          authService,
        };
      },
      introspection: !isProduction,
      validationRules: [depthLimit(10) as any],
      plugins,
      // Issue #217 – Enable automatic persisted queries to reduce payload size
      // Clients can send a hash of the query instead of the full query text.
      // Falls back to full query if hash is not found in the APQ cache.
      persistedQueries: {
        cache: new Map<string, string>(),
      },
      // Issue #340 – classify errors and attach user-friendly messages before
      // sending them to the client. Internal details stay in server logs only.
      formatError: formatGraphQLError,
    });
  }

  async start(): Promise<void> {
    try {
      this.logger.info('Starting Stellar Analytics API Server...');

      this.validateEnvironment();
      await db.connect();
      this.logger.info('Database connections established');

      // Initialise performance alerting (reads env vars automatically)
      const perfAlerting = initPerfAlerting(this.logger);
      perfAlerting.startHealthPolling(() => db.healthCheck());

      await this.apolloServer.start();
      this.logger.info('Apollo Server started');

      this.apolloServer.applyMiddleware({
        app: this.app as any,
        path: '/graphql',
        cors: false,
      });

      await mountAdminGraphQL(this.app, this.logger);

      this.httpServer = createServer(this.app);
      this.httpServer.timeout = 30000; // 30s default timeout
      this.setupWebSocketServer();
      await this.realtimePublisher.start();

      const port = process.env.PORT || 4000;
      this.httpServer.listen(port, () => {
        this.logger.info(`Server ready at http://localhost:${port}/graphql`);
        this.logger.info(`Subscriptions ready at ws://localhost:${port}/graphql`);
      });
    } catch (error) {
      this.logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private setupWebSocketServer(): void {
    const wsServer = new WebSocketServer({
      server: this.httpServer,
      path: '/graphql',
    });

    const schema = (this.apolloServer as any).schema;

    // Cleanup rate limits periodically
    setInterval(cleanupRateLimits, 60000);

    useServer(
      {
        schema,
        context: async (ctx: any, msg: any, _args: any) => {
          const connectionParams = ctx?.connectionParams || {};
          const token = connectionParams?.token || msg?.payload?.headers?.authorization?.replace('Bearer ', '');

          if (process.env.JWT_SECRET && token) {
            try {
              const user = verify(token, process.env.JWT_SECRET);
              return { db, loaders: createLoaders(), logger: this.logger, user };
            } catch (err) {
              throw new Error('Invalid authentication token');
            }
          }

          return { db, loaders: createLoaders(), logger: this.logger };
        },
        onConnect: (ctx: any) => {
          const ip = ctx?.request?.socket?.remoteAddress || 'unknown';

          if (!checkSubscriptionRateLimit(ip)) {
            throw new Error('Subscription rate limit exceeded');
          }

          this.logger.info('WebSocket client connected', { ip });
          return { ip, authenticated: !!ctx?.connectionParams?.token };
        },
        onSubscribe: (ctx: any, msg: any) => {
          const ip = ctx?.ip || 'unknown';

          if (!checkEventRateLimit(ip)) {
            throw new Error('Event rate limit exceeded');
          }

          this.logger.info('WebSocket subscription started', {
            ip,
            query: msg?.payload?.query?.substring(0, 100),
          });
        },
        onDisconnect: (ctx: any, code?: number, reason?: string) => {
          this.logger.info('WebSocket client disconnected', { code, reason });
        },
        onError: (ctx: any, msg: any, errors: any) => {
          const ip = ctx?.ip || 'unknown';
          this.logger.warn('WebSocket error', { ip, errors });
        },
      },
      wsServer
    );
  }

  private validateEnvironment(): void {
    const requiredEnvVars = ['DATABASE_URL', 'REDIS_URL'];

    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Shutting down server...');

    try {
      getPerfAlerting()?.stopHealthPolling();
      this.realtimePublisher.stop();
      await this.apolloServer.stop();
      await db.disconnect();

      if (this.httpServer) {
        this.httpServer.close();
      }

      this.logger.info('Server shut down successfully');
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      throw error;
    }
  }
}

if (require.main === module) {
  const server = new ApiServer();

  const gracefulShutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

    try {
      await server.stop();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  server.start().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { ApiServer };
