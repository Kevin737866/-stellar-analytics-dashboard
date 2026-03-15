# Stellar Analytics Dashboard

A comprehensive analytics platform for the Stellar blockchain with real-time data ingestion, GraphQL API, and React visualization dashboard.

## 🌟 Features

- **Real-time Data Ingestion**: Continuously polls Stellar Horizon API for ledgers, transactions, and operations
- **GraphQL API**: High-performance API with complex aggregations and analytics queries
- **React Dashboard**: Modern, responsive analytics interface with real-time charts
- **Soroban Support**: Track smart contract deployments and interactions
- **DEX Analytics**: Monitor asset volumes, liquidity pools, and trading activity
- **Account Profiling**: Track account activity, balances, and portfolio performance
- **Transaction Explorer**: Detailed transaction analysis with XDR decoding

## 🏗️ Architecture

```
stellar-analytics-dashboard/
├── packages/
│   ├── shared/          # Shared types and utilities
│   ├── indexer/         # Node.js data ingestion service
│   ├── api/            # Express GraphQL server
│   └── frontend/       # React analytics dashboard
├── docker-compose.yml   # Production deployment
├── docker-compose.dev.yml # Development setup
└── README.md
```

### Components

- **Indexer**: Polls Horizon API, stores data in PostgreSQL, provides real-time updates
- **API**: GraphQL server with analytics queries, caching, and subscriptions
- **Frontend**: React dashboard with real-time charts and data visualization
- **Database**: PostgreSQL for analytics data, Redis for caching

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- pnpm (recommended) or npm

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Kevin737866/stellar-analytics-dashboard.git
   cd stellar-analytics-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install -g pnpm
   pnpm install
   ```

3. **Start development environment**
   ```bash
   # Start databases only
   docker-compose -f docker-compose.dev.yml up -d
   
   # Install dependencies and start services
   pnpm dev
   ```

4. **Access the applications**
   - Frontend: http://localhost:3000
   - GraphQL API: http://localhost:4000/graphql
   - Indexer Health: http://localhost:3001/health

### Production Deployment

1. **Build and deploy with Docker**
   ```bash
   docker-compose up -d
   ```

2. **Access the applications**
   - Frontend: http://localhost:3000
   - GraphQL API: http://localhost:4000/graphql
   - Indexer: http://localhost:3001

## 📊 Usage

### GraphQL API

The GraphQL API provides access to all Stellar analytics data. Key queries include:

```graphql
# Get network statistics
query GetStats {
  stats {
    totalTransactions
    totalAccounts
    volume24h
    successRate24h
    latestLedger
  }
}

# Get recent transactions
query GetTransactions($first: Int = 20) {
  transactions(pagination: { first: $first }) {
    edges {
      node {
        hash
        successful
        sourceAccount
        feeCharged
        createdAt
        operationCount
      }
    }
  }
}

# Get account details
query GetAccount($accountId: String!) {
  account(accountId: $accountId) {
    accountId
    balance
    sequenceNumber
    numSubentries
    thresholds
  }
}
```

### Real-time Subscriptions

```graphql
subscription OnNewLedger {
  ledgerAdded {
    sequence
    closedAt
    operationCount
    successfulTransactionCount
  }
}
```

### Frontend Features

- **Dashboard**: Overview of network metrics and activity
- **Network**: Detailed network performance analytics
- **Accounts**: Account explorer and profiling
- **Transactions**: Transaction search and analysis
- **Assets**: Asset analytics and DEX metrics

## 🔧 Configuration

### Environment Variables

#### Indexer (packages/indexer/.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/stellar_analytics
REDIS_URL=redis://localhost:6379
STELLAR_NETWORK=public
STELLAR_HORIZON_URL=https://horizon.stellar.org
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
```

#### API (packages/api/.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/stellar_analytics
REDIS_URL=redis://localhost:6379
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info
```

#### Frontend (packages/frontend/.env)
```env
VITE_API_URL=http://localhost:4000/graphql
VITE_WS_URL=ws://localhost:4000/graphql
```

### Database Schema

The application uses PostgreSQL with the following main tables:

- `ledgers`: Stellar ledger data
- `transactions`: Transaction records
- `operations: Operation details
- `accounts`: Account information
- `assets`: Asset metadata
- `network_metrics`: Aggregated network statistics
- `asset_metrics`: Asset-specific analytics
- `account_metrics`: Account activity metrics

## 🛠️ Development

### Package Scripts

```bash
# Root level
pnpm dev              # Start all services in development
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # Lint all packages

# Individual packages
pnpm --filter @stellar-analytics/indexer dev
pnpm --filter @stellar-analytics/api dev
pnpm --filter @stellar-analytics/frontend dev
```

### Database Migrations

```bash
# Run migrations
pnpm --filter @stellar-analytics/indexer db:migrate

# Seed with initial data
pnpm --filter @stellar-analytics/indexer db:seed
```

### Adding New Features

1. **Shared Types**: Add new types to `packages/shared/src/types/`
2. **Database Schema**: Update `packages/indexer/src/database/schema.sql`
3. **API Resolvers**: Add resolvers to `packages/api/src/resolvers/`
4. **Frontend Components**: Add components to `packages/frontend/src/components/`

## 📈 Monitoring

### Health Checks

- Indexer: `GET /health`
- API: `GET /health`
- Database: PostgreSQL health check
- Redis: `PING` command

### Metrics

- Prometheus-compatible metrics at `/metrics`
- Application logs in structured JSON format
- Performance monitoring with Apollo Studio (optional)

## 🔒 Security

- Input validation with Zod schemas
- SQL injection prevention with parameterized queries
- Rate limiting on API endpoints
- CORS configuration
- Environment variable management
- Non-root Docker containers

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @stellar-analytics/api test

# Run with coverage
pnpm test --coverage
```

## 📚 API Reference

### GraphQL Endpoints

- **Production**: `https://your-domain.com/graphql`
- **Development**: `http://localhost:4000/graphql`

### REST Endpoints

- **Health Check**: `GET /health`
- **Metrics**: `GET /metrics`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use ESLint and Prettier formatting
- Write tests for new features
- Update documentation
- Use conventional commit messages

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Stellar Development Foundation](https://stellar.org/) for the amazing blockchain
- [Stellar SDK](https://github.com/stellar/js-stellar-sdk) for excellent developer tools
- [Apollo GraphQL](https://apollographql.com/) for powerful GraphQL tools
- [React](https://reactjs.org/) for the frontend framework
- [Recharts](https://recharts.org/) for beautiful charts

## 📞 Support

- Create an issue on GitHub for bug reports
- Join our Discord community for discussions
- Check the documentation for common questions

---

**Built with ❤️ for the Stellar ecosystem**
