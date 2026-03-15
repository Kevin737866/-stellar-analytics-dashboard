import dotenv from 'dotenv';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import winston from 'winston';

import { typeDefs } from './schema/typeDefs';
import { resolvers } from './resolvers';
import { db } from './database/connection';
import * as loaders from './loaders';

// Load environment variables
dotenv.config();

class ApiServer {
  private apolloServer: ApolloServer;
  private app: express.Application;
  private httpServer: any;
  private logger: winston.Logger;

  constructor() {
    this.app = express();
    this.setupLogger();
    this.setupMiddleware();
    this.setupApolloServer();
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
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
      ],
    });
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable CSP for GraphQL Playground
      crossOriginEmbedderPolicy: false,
    }));

    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    }));

    // Compression
    this.app.use(compression());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
    });
    this.app.use('/graphql', limiter);

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', (req, res) => {
      res.set('Content-Type', 'text/plain');
      res.send('# HELP graphql_server_status Status of the GraphQL server\n# TYPE graphql_server_status gauge\ngraphql_server_status 1\n');
    });
  }

  private setupApolloServer(): void {
    this.apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      context: ({ req, res }) => {
        return {
          req,
          res,
          db,
          loaders,
          logger: this.logger,
        };
      },
      introspection: process.env.NODE_ENV !== 'production',
      plugins: [
        {
          requestDidStart() {
            return {
              didResolveOperation(requestContext) {
                this.logger?.info('GraphQL operation resolved', {
                  operation: requestContext.request.operationName,
                  variables: requestContext.request.variables,
                });
              },
              didEncounterErrors(requestContext) {
                this.logger?.error('GraphQL operation errors', {
                  operation: requestContext.request.operationName,
                  errors: requestContext.errors,
                });
              },
            };
          },
        },
      ],
    });
  }

  async start(): Promise<void> {
    try {
      this.logger.info('🚀 Starting Stellar Analytics API Server...');

      // Validate environment
      this.validateEnvironment();

      // Connect to databases
      await db.connect();
      this.logger.info('✅ Database connections established');

      // Start Apollo Server
      await this.apolloServer.start();
      this.logger.info('✅ Apollo Server started');

      // Apply middleware
      this.apolloServer.applyMiddleware({ 
        app: this.app, 
        path: '/graphql',
        cors: false, // We handle CORS ourselves
      });

      // Create HTTP server
      this.httpServer = createServer(this.app);

      // Setup WebSocket subscriptions
      this.setupWebSocketServer();

      // Start listening
      const port = process.env.PORT || 4000;
      this.httpServer.listen(port, () => {
        this.logger.info(`🚀 Server ready at http://localhost:${port}/graphql`);
        this.logger.info(`🚀 Subscriptions ready at ws://localhost:${port}/graphql`);
      });

    } catch (error) {
      this.logger.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  private setupWebSocketServer(): void {
    const wsServer = new WebSocketServer({
      server: this.httpServer,
      path: '/graphql',
    });

    useServer(
      {
        schema: { typeDefs, resolvers },
        context: async (ctx, msg, args) => {
          return {
            db,
            loaders,
            logger: this.logger,
          };
        },
        onConnect: (ctx) => {
          this.logger.info('WebSocket client connected');
          return true;
        },
        onDisconnect: (ctx, code, reason) => {
          this.logger.info('WebSocket client disconnected', { code, reason });
        },
      },
      wsServer
    );
  }

  private validateEnvironment(): void {
    const requiredEnvVars = [
      'DATABASE_URL',
      'REDIS_URL',
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  }

  async stop(): Promise<void> {
    this.logger.info('🛑 Shutting down server...');
    
    try {
      await this.apolloServer.stop();
      await db.disconnect();
      
      if (this.httpServer) {
        this.httpServer.close();
      }
      
      this.logger.info('✅ Server shut down successfully');
    } catch (error) {
      this.logger.error('❌ Error during shutdown:', error);
      throw error;
    }
  }
}

// Start the application
if (require.main === module) {
  const server = new ApiServer();
  
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    
    try {
      await server.stop();
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  server.start().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { ApiServer };
