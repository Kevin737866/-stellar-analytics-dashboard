# CI Operational Notes

This document provides operational guidance for the CI/CD pipeline for the Stellar Analytics Dashboard.

## CI Workflows

### CI Workflow (`.github/workflows/ci.yml`)

The main CI workflow runs on every push and pull request to `main` and `develop` branches. It includes:

#### Unit Tests Job
- Runs frontend unit tests with coverage
- Uploads coverage report to artifacts
- **Runtime**: ~10 minutes

#### Migration Integration Tests Job.
- Runs database migration tests
- Requires PostgreSQL service
- **Runtime**: ~10 minutes
- **Port**: 5433

#### E2E Tests Job
- Runs Playwright E2E tests
- Requires PostgreSQL and Redis services
- **Runtime**: ~25 minutes
- **Ports**: 5432 (PostgreSQL), 6379 (Redis)
- **Quarantined tests**: Skipped automatically (flaky tests are excluded)

#### Deployment Smoke Tests Job
- Verifies the deployed application is functional
- **Runtime**: ~10 minutes
- **Note**: Requires a running deployment to test against
- **Manual run**: `pnpm --filter @stellar-analytics/e2e test:smoke --url <deployment-url>`

### Deployment Smoke Tests Workflow (`.github/workflows/deployment-smoke-tests.yml`)

This workflow runs deployment smoke tests against a deployed instance. It can be:

1. **Triggered manually** via GitHub UI (workflow_dispatch)
2. **Triggered automatically** after successful "Build and Deploy" workflow

#### Inputs
- `deployment-url`: URL of the deployed application (required for manual runs)
- `environment`: Deployment environment (staging, production)
- `branch`: Branch being deployed

#### Outputs
- Test results as artifacts
- GitHub checks with test status
- PR comments with test summary

### GraphQL Schema Validation Workflow (`.github/workflows/graphql-schema-validation.yml`)

This workflow validates that:
1. The API schema is valid GraphQL SDL
2. Frontend GraphQL queries are syntactically correct
3. Frontend queries use fields defined in the API schema

#### Runtime
- ~5 minutes

#### What It Validates
- API schema syntax is valid GraphQL SDL
- Frontend queries parse correctly
- No duplicate operation names
- Frontend queries use fields from the API schema

### Container Vulnerability Scan Workflow (`.github/workflows/container-scan.yml`)

This workflow scans for container and dependency vulnerabilities:

1. **trivy-scan** (15 minutes): Scans project files for vulnerabilities
2. **dockerfile-lint** (5 minutes): Validates Dockerfiles against best practices
3. **docker-compose-lint** (5 minutes): Validates Docker Compose configurations

#### Triggers
- Push to `main` and `develop` branches
- Pull requests to `main` and `develop`
- Nightly at 2 AM UTC

#### Runtime
- ~25 minutes total

#### What It Scans
- Node.js dependencies
- Docker images
- Dockerfile best practices
- Docker Compose security settings

## Running CI Locally

### Unit Tests

```bash
pnpm --filter @stellar-analytics/frontend test:ci
```

### Migration Tests

```bash
pnpm --filter @stellar-analytics/indexer test:migrations
```

### E2E Tests

```bash
pnpm --filter @stellar-analytics/e2e test:ci
```

### Smoke Tests

```bash
pnpm --filter @stellar-analytics/e2e test:smoke --url https://staging.example.com
```

### GraphQL Schema Validation

```bash
# Development mode
pnpm exec tsx scripts/validate-graphql-schemas.ts

# CI mode
pnpm run test:schema:ci
```

### Container Vulnerability Scan

```bash
# Filesystem scan (recommended for development)
pnpm exec bash scripts/scan-containers.sh filesystem

# Full scan
pnpm exec bash scripts/scan-containers.sh all

# With custom severity
SCAN_SEVERITY=CRITICAL,HIGH,MEDIUM pnpm exec bash scripts/scan-containers.sh filesystem
```

## Troubleshooting CI Failures

### Test Timeout

- **Symptom**: Test fails with timeout error
- **Diagnosis**: Application is not responding within expected time
- **Resolution**: 
  - Check service health endpoints
  - Verify database and Redis connectivity
  - Check for high load or resource constraints

### Connection Refused

- **Symptom**: Connection refused error for database or Redis
- **Diagnosis**: Service not started or port mismatch
- **Resolution**: 
  - Verify service ports in workflow
  - Check service health before running tests
  - Increase health check timeouts if needed

### Smoke Tests Skip

- **Symptom**: Smoke tests skip with "requires deployed instance" message
- **Diagnosis**: Smoke tests require a running deployment
- **Resolution**: 
  - Use the Deployment Smoke Tests workflow manually
  - Or run locally with a deployment URL

### GraphQL Schema Validation Failures

#### Schema Parsing Error

- **Symptom**: "Failed to parse schema.ts"
- **Diagnosis**: Schema.ts may have syntax errors
- **Resolution**: 
  - Check `packages/api/src/schema.ts` for proper SDL syntax
  - Ensure the `typeDefs` export follows the template literal pattern

#### Query Parsing Error

- **Symptom**: "Failed to parse query"
- **Diagnosis**: The GraphQL query may have syntax errors
- **Resolution**: 
  - Check the specific query in `packages/frontend/src/graphql/queries.ts`
  - Validate query syntax using a GraphQL editor or playground

#### Duplicate Operation Name

- **Symptom**: "Operation name already exists"
- **Diagnosis**: Duplicate operation names across files
- **Resolution**: 
  - Ensure all operation names are unique
  - Use descriptive names that reflect the query purpose

### Container Vulnerability Scan Failures

#### Trivy Not Installed

- **Symptom**: "command not found: trivy"
- **Diagnosis**: Trivy is not installed locally
- **Resolution**: 
  - Install Trivy: `curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin`
  - Or run the CI workflow which includes Trivy setup

#### Docker Image Scan Fails

- **Symptom**: "Cannot connect to Docker daemon"
- **Diagnosis**: Docker daemon is not running
- **Resolution**: 
  - Start Docker Desktop or Docker service
  - Use filesystem scan instead: `pnpm exec bash scripts/scan-containers.sh filesystem`

#### Hadolint Not Installed

- **Symptom**: "command not found: hadolint"
- **Diagnosis**: Hadolint is not installed locally
- **Resolution**: 
  - Install Hadolint: `brew install hadolint` (macOS) or download from releases
  - Or run the CI workflow which includes Hadolint setup

## CI/CD Pipeline Flow

```
PR / Push → CI Workflow
  ├─ Unit Tests
  ├─ Migration Tests
  ├─ E2E Tests
  └─ Deployment Smoke Tests (main only)
       ↓
Build and Deploy
  ↓
Deployment Smoke Tests Workflow (auto or manual)

PR / Push → GraphQL Schema Validation Workflow
  └─ Validate API schema and frontend queries sync

PR / Push → Container Vulnerability Scan Workflow
  ├─ Trivy: Filesystem + Docker image scanning
  ├─ Hadolint: Dockerfile linting
  └─ docker-compose-lint: Configuration validation
```

## Environment Variables

### CI Workflow
- `CI`: Set to `true` for CI mode
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `BASE_URL`: Frontend application URL

### Deployment Smoke Tests
- `BASE_URL`: URL of deployed application
- `CI`: Set to `true` for CI mode
- `DEPLOYMENT_BRANCH`: Branch being deployed
- `DEPLOYMENT_ENVIRONMENT`: Environment (staging, production)

### GraphQL Schema Validation
- `SLOW_MODE`: Set to `true` for verbose output

### Container Vulnerability Scan
- `SCAN_SEVERITY`: Severity levels (CRITICAL,HIGH,MEDIUM,LOW)
- `OUTPUT_FORMAT`: Output format (table,sarif,json)
- `SCAN_DIR`: Directory to scan (default: `.`)
- `OUTPUT_FILE`: Output file path

## Artifacts

### Coverage Reports
- **Name**: `frontend-coverage`
- **Path**: `packages/frontend/coverage/`
- **Retention**: 14 days

### E2E Test Results
- **Name**: `e2e-test-results`
- **Path**: `packages/e2e/test-results/`, `packages/e2e/playwright-report/`
- **Retention**: 14 days

### Smoke Test Results
- **Name**: `smoke-test-results-${run_id}`
- **Path**: `packages/e2e/test-results/smoke/`, `packages/e2e/playwright-report/`
- **Retention**: 14 days

### Vulnerability Scan Results
- **Format**: SARIF (uploaded to GitHub Security tab)
- **Retention**: Available in GitHub Security tab

## Best Practices

1. **Test Isolation**: Each job runs independently with its own services
2. **Cleanup**: Services are automatically cleaned up after each job
3. **Artifacts**: Always upload test results for debugging
4. **Comments**: PR comments provide immediate feedback on test results
5. **Smoke Tests**: Run smoke tests against staging before production deployment
6. **Schema Sync**: Validate GraphQL schema sync before merging schema changes
7. **Security Scans**: Run vulnerability scans before deployment
8. **Fix Critical Issues**: Address CRITICAL and HIGH vulnerabilities immediately

## Related Documentation

- [E2E Testing Guide](./E2E_TESTS_COMPLETE.md)
- [Deployment Smoke Tests](./DEPLOYMENT_SMOKE_TESTS.md)
- [GraphQL Schema Validation](./GRAPHQL_SCHEMA_VALIDATION.md)
- [Container Vulnerability Scanning](./CONTAINER_VULNERABILITY_SCANNING.md)
- [Release Notes Process](./release-notes-process.md)
