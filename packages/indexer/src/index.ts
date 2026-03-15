import dotenv from 'dotenv';
import { StellarService } from './services/stellar-service';
import { IndexerService } from './services/indexer-service';
import { db } from './database/connection';
import { runMigrations } from './database/migrate';
import { STELLAR_NETWORKS, HORIZON_URLS } from '@stellar-analytics/shared';

// Load environment variables
dotenv.config();

class IndexerApp {
  private stellarService: StellarService;
  private indexerService: IndexerService;
  private isShuttingDown: boolean = false;

  constructor() {
    const network = process.env.STELLAR_NETWORK || STELLAR_NETWORKS.PUBLIC;
    const horizonUrl = process.env.STELLAR_HORIZON_URL || HORIZON_URLS[network];
    
    this.stellarService = new StellarService(horizonUrl);
    this.indexerService = new IndexerService(this.stellarService);
    
    this.setupGracefulShutdown();
  }

  async start(): Promise<void> {
    try {
      console.log('🚀 Starting Stellar Analytics Indexer...');
      
      // Validate environment
      this.validateEnvironment();
      
      // Connect to databases
      await db.connect();
      console.log('✅ Database connections established');
      
      // Run migrations
      await runMigrations();
      console.log('✅ Database migrations completed');
      
      // Test Horizon connection
      const isConnected = await this.stellarService.testConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to Stellar Horizon');
      }
      console.log('✅ Connected to Stellar Horizon');
      
      // Start the indexer
      await this.indexerService.start();
      console.log('✅ Indexer started successfully');
      
      // Start health check server
      this.startHealthCheckServer();
      
      console.log('🎉 Stellar Analytics Indexer is running!');
      
    } catch (error) {
      console.error('❌ Failed to start indexer:', error);
      process.exit(1);
    }
  }

  private validateEnvironment(): void {
    const requiredEnvVars = [
      'DATABASE_URL',
      'REDIS_URL',
      'STELLAR_NETWORK',
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  }

  private startHealthCheckServer(): void {
    const http = require('http');
    
    const server = http.createServer(async (req: any, res: any) => {
      if (req.url === '/health') {
        try {
          const status = await this.indexerService.getStatus();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            ...status
          }));
        } catch (error) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
          }));
        }
      } else if (req.url === '/metrics') {
        // Basic metrics endpoint
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('# HELP stellar_indexer_status Status of the Stellar indexer\n# TYPE stellar_indexer_status gauge\nstellar_indexer_status 1\n');
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    const port = process.env.PORT || 3001;
    server.listen(port, () => {
      console.log(`📊 Health check server listening on port ${port}`);
    });
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
      this.isShuttingDown = true;
      
      try {
        await this.indexerService.stop();
        await db.disconnect();
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
  }
}

// Start the application
if (require.main === module) {
  const app = new IndexerApp();
  app.start().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { IndexerApp };
