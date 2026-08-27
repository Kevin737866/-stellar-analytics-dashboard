# Startup Troubleshooting

**Last Updated:** 2026-08-27  
**Last Verified:** 2026-08-27  
**Next Review:** 2026-11-27  
**Owner:** Platform Engineering Team

Solutions for the most common Docker, Node, and database startup problems in the Stellar Analytics Dashboard monorepo.

---

## Quick-start checklist

Before digging into individual symptoms, run through this list first:

```bash
# 1. Node version ≥ 18
node --version

# 2. pnpm installed
pnpm --version   # should be 9.x

# 3. Dependencies installed
pnpm install

# 4. Docker daemon running
docker info

# 5. Ports 5432, 6379, 4000, 5173, 3001 are free
# (see "Port already in use" below)

# 6. .env files exist for each package
ls packages/api/.env
ls indexer/.env
```

---

## Docker problems

### `docker compose up` hangs or services restart indefinitely

**Symptom**: Containers start but keep restarting; `docker compose ps` shows `Restarting`.

**Diagnosis**

```bash
docker compose logs postgres
docker compose logs redis
```

**Common causes and fixes**

| Cause | Fix |
|-------|-----|
| Port 5432 already in use by a local Postgres | Stop local Postgres: `sudo systemctl stop postgresql` (Linux) or stop it in Services (Windows) |
| Port 6379 already in use by a local Redis | `sudo systemctl stop redis` or kill the process (see "Port already in use") |
| Previous volume has corrupted data | `docker compose down -v` then `docker compose up -d` (⚠️ deletes all local data) |
| `PGPASSWORD` mismatch between service and backup container | Check that `POSTGRES_PASSWORD` in `docker-compose.yml` matches `PGPASSWORD` in the `postgres-backup` service |
| Docker doesn't have enough memory | Increase Docker Desktop memory to at least 2 GB in Settings → Resources |

---

### `postgres` healthcheck fails → dependant services won't start

**Symptom**: `api` or `indexer` containers show `service "postgres" is not healthy`.

```bash
# Check the healthcheck directly
docker compose exec postgres pg_isready -U stellar -d stellar_analytics
```

If that returns `accepting connections`, the healthcheck just needs more retries. Bump the compose healthcheck:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U stellar -d stellar_analytics"]
  interval: 10s
  timeout: 5s
  retries: 10        # ← was 5, increase if startup is slow
  start_period: 20s  # ← give Postgres time to initialise WAL
```

---

### `docker compose up` fails with `permission denied` on WAL archive directory

**Symptom**:

```
archive command failed with exit code 1
cp: cannot create regular file '/var/lib/postgresql/wal_archive/…': Permission denied
```

**Fix**:

```bash
# Create the directory and set correct ownership
mkdir -p backups/wal
# On Linux/macOS:
sudo chown -R 999:999 backups/wal
# On Windows (WSL2) – run inside WSL terminal:
sudo chown -R 999:999 backups/wal
```

---

### `postgres-backup` service exits immediately

The backup service is configured with `RUN_ONCE=true` when triggered manually via `pnpm backup:run`. When run as a long-running service it loops on a `BACKUP_INTERVAL_SECONDS` schedule. If it exits:

```bash
docker compose logs postgres-backup
```

Common causes:
- `POSTGRES_HOST` not resolving – ensure it is the Docker service name (`postgres`), not `localhost`.
- `PGPASSWORD` not set – check the environment block in `docker-compose.yml`.

---

## Node / pnpm problems

### `pnpm install` fails with `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`

**Symptom**: Package resolution errors for `@stellar-analytics/shared` or other workspace packages.

**Fix**:

```bash
# Ensure pnpm-workspace.yaml is present at the root
cat pnpm-workspace.yaml

# Force a clean install
pnpm store prune
pnpm install --frozen-lockfile
```

---

### `Cannot find module '@stellar-analytics/shared'` at runtime

The shared package must be built before dependant packages start.

```bash
pnpm --filter @stellar-analytics/shared build
pnpm --filter @stellar-analytics/indexer build
pnpm --filter @stellar-analytics/api build
```

Or run all builds in dependency order:

```bash
pnpm build
```

---

### `ts-node` / `tsc` fails with `Cannot find module 'X'`

This usually means `node_modules` is stale or a workspace symlink is broken.

```bash
# Clean and reinstall
pnpm -r exec -- rm -rf node_modules
rm -rf node_modules
pnpm install
```

---

### `EACCES: permission denied` when running scripts on Linux/macOS

```bash
# Fix script permissions
chmod +x scripts/backup/*.sh
chmod +x .husky/*
```

---

### Node version mismatch

The project requires Node.js **18 or higher**. Using an older version causes build and runtime errors.

```bash
node --version   # must be ≥ 18

# Switch with nvm
nvm install 20
nvm use 20

# Or with volta
volta install node@20
```

---

## API service startup problems (`packages/api`)

### `Missing required environment variables: DATABASE_URL, REDIS_URL`

Copy and fill in the template:

```bash
cp packages/api/.env.example packages/api/.env
```

Minimum required values:

```dotenv
DATABASE_URL=postgresql://stellar_user:stellar_password@localhost:5432/stellar_analytics_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=change_me_to_a_random_32_char_string
```

---

### `Error: connect ECONNREFUSED 127.0.0.1:5432`

The API cannot reach Postgres. Checklist:

1. Is Postgres running?
   ```bash
   docker compose ps postgres
   # or
   pg_isready -h localhost -p 5432
   ```
2. Is `DATABASE_URL` pointing at `localhost:5432` (host) or at the Docker service name? When running the API outside Docker use `localhost`; inside Docker use the service name (`postgres`).
3. Is the database user and database name correct? Compare `DATABASE_URL` with the `POSTGRES_USER` and `POSTGRES_DB` values in `docker-compose.dev.yml`.

---

### `Error: connect ECONNREFUSED 127.0.0.1:6379`

Redis is not reachable. Start it:

```bash
docker compose -f docker-compose.dev.yml up -d redis
```

Then verify:

```bash
redis-cli ping   # should return PONG
```

---

### Apollo Server fails to start: `Port 4000 already in use`

```bash
# Find the process
# Windows PowerShell:
Get-NetTCPConnection -LocalPort 4000 | Select-Object OwningProcess
Get-Process -Id <OwningProcess>
Stop-Process -Id <OwningProcess>

# macOS/Linux:
lsof -i :4000 -t | xargs kill -9
```

---

### `JWT_SECRET` too short error

The secret must be at least 32 characters. Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Indexer service startup problems (`packages/indexer`)

### `Missing required environment variables: STELLAR_NETWORK`

```bash
cp packages/indexer/.env.example packages/indexer/.env
# then set STELLAR_NETWORK=public (or testnet)
```

---

### `Failed to connect to Stellar Horizon`

- Check your internet connection and that `https://horizon.stellar.org` is reachable.
- For a local/testnet setup, set `STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org` and `STELLAR_NETWORK=testnet`.
- If you're behind a corporate proxy, set `HTTPS_PROXY` in the environment.

---

### Database migrations fail on first run

```bash
# Run migrations manually
pnpm db:migrate

# Check for errors
pnpm --filter @stellar-analytics/indexer db:migrate
```

If migrations fail because the database doesn't exist:

```bash
# Create the database (outside Docker)
createdb -U stellar_user stellar_analytics_dev

# Or inside the running Postgres container
docker compose exec postgres createdb -U stellar stellar_analytics
```

---

### Indexer exits immediately with `SIGTERM`

This can happen when running under a process manager that sends SIGTERM quickly. Check that `NODE_ENV` and `STELLAR_NETWORK` are set. Also confirm the health-check port (default `3001`) is not already bound:

```bash
lsof -i :3001   # Linux/macOS
Get-NetTCPConnection -LocalPort 3001  # Windows
```

---

## Frontend startup problems (`packages/frontend`)

### Vite dev server fails to start: `Port 5173 already in use`

```bash
# Kill the process on that port (Linux/macOS)
lsof -i :5173 -t | xargs kill -9

# Or choose a different port
VITE_PORT=5174 pnpm --filter @stellar-analytics/frontend dev
```

---

### `Failed to fetch` / blank dashboard after login

The frontend proxies `/graphql` to the API. Make sure the API is running on port 4000:

```bash
curl http://localhost:4000/health
```

If the API is on a different port, update `VITE_GRAPHQL_URL` in `packages/frontend/.env`:

```dotenv
VITE_GRAPHQL_URL=http://localhost:4001/graphql
```

---

### Tailwind styles not applied (all styles missing)

The PostCSS/Tailwind pipeline requires a build step in production. In development, Vite handles this automatically. If styles are missing:

```bash
# Restart the dev server with a clean cache
pnpm --filter @stellar-analytics/frontend exec vite --force
```

---

## Database migration problems

### `relation "migrations" does not exist`

`node-pg-migrate` creates its own tracking table on the first run. If you see this error, the migration runner couldn't connect:

```bash
# Verify DATABASE_URL is exported
echo $DATABASE_URL

# Run with explicit connection string
DATABASE_URL=postgresql://stellar_user:stellar_password@localhost:5432/stellar_analytics_dev pnpm db:migrate
```

---

### Migration fails with `column already exists`

A migration was partially applied. Roll it back and re-apply:

```bash
pnpm db:migrate:down   # rolls back one migration
pnpm db:migrate        # re-applies
```

If `migrate:down` also fails, connect to Postgres and drop the partially created objects manually, then repeat.

---

### `pnpm db:migrate` reports "no migrations to run"

Check the migration files are present:

```bash
ls packages/indexer/migrations/
```

If the directory is empty, the migrations were not committed. Pull the latest changes:

```bash
git pull origin main
pnpm db:migrate
```

---

## Port reference

| Service | Default port | Override env var |
|---------|-------------|-----------------|
| Postgres | 5432 | — |
| Redis | 6379 | — |
| API (GraphQL) | 4000 | `PORT` |
| Indexer (health) | 3001 | `PORT` |
| Frontend (Vite) | 5173 | `VITE_PORT` |

---

## Full clean restart

When nothing else works, a full teardown and rebuild usually resolves environment drift:

```bash
# 1. Stop all containers and remove volumes (⚠️ destroys local data)
docker compose down -v
docker compose -f docker-compose.dev.yml down -v

# 2. Clean node_modules and build artifacts
pnpm -r exec -- rm -rf node_modules dist
rm -rf node_modules

# 3. Reinstall
pnpm install

# 4. Build shared package first
pnpm --filter @stellar-analytics/shared build

# 5. Start infrastructure
docker compose -f docker-compose.dev.yml up -d

# 6. Run migrations
pnpm db:migrate

# 7. Start services
pnpm dev
```

---

## Getting more help

- Check container logs: `docker compose logs <service> --tail=100`
- Check API logs: `logs/combined.log`, `logs/error.log` (inside `packages/api/`)
- Check indexer logs: run with `LOG_LEVEL=debug` for verbose output
- Open a GitHub issue with the output of `docker compose ps` and the relevant log tail
- See also: [E2E Test Troubleshooting](../packages/e2e/TROUBLESHOOTING.md)
