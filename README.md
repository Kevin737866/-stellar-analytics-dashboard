# Stellar Analytics Dashboard

Monorepo scaffold for a Stellar blockchain analytics platform with a data pipeline, GraphQL API, React dashboard, and shared TypeScript package.

## Project Structure

```text
.
+-- indexer/
¦   +-- src/
¦       +-- ingester.ts
¦       +-- transformer.ts
¦       +-- loader.ts
¦       +-- websocket.ts
¦       +-- index.ts
¦       +-- database/schema.sql
+-- api/
¦   +-- src/
¦       +-- schema.ts
¦       +-- resolvers/
¦       +-- index.ts
+-- frontend/
¦   +-- src/
¦       +-- components/
¦       +-- hooks/
¦       +-- pages/
¦       +-- App.tsx
¦       +-- main.tsx
+-- shared/
¦   +-- src/
¦       +-- config/networks.ts
¦       +-- types/
¦       +-- utils/
+-- docker-compose.yml
+-- package.json
+-- pnpm-workspace.yaml
```

## Stellar Network Config

Shared network configuration is in `shared/src/config/networks.ts`:
- `mainnet` Horizon: `https://horizon.stellar.org`
- `testnet` Horizon: `https://horizon-testnet.stellar.org`

## Database Schema

`indexer/src/database/schema.sql` initializes these tables:
- `blocks`
- `transactions`
- `operations`
- `ledgers`

## Local Setup

1. Install dependencies:

```bash
pnpm install
```

2. Start PostgreSQL and Redis:

```bash
docker compose up -d postgres redis
```

3. Run services in separate terminals:

```bash
pnpm --filter @stellar-analytics/indexer dev
pnpm --filter @stellar-analytics/api dev
pnpm --filter @stellar-analytics/frontend dev
```

## Endpoints

- API GraphQL + playground: `http://localhost:4000/graphql`
- Frontend (Vite): `http://localhost:5173`
