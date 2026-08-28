# Contributing to Stellar Analytics Dashboard

Thank you for your interest in contributing to the Stellar Analytics Dashboard! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (Node 20 recommended — see [`docs/node-versions.md`](docs/node-versions.md))
- Docker & Docker Compose
- pnpm (recommended) or npm
- Git

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/stellar-analytics-dashboard.git
   cd stellar-analytics-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install -g pnpm
   pnpm install
   ```

3. **Set up development environment**
   ```bash
   # Start databases
   docker-compose -f docker-compose.dev.yml up -d
   
   # Start development servers
   pnpm dev
   ```

## 📁 Project Structure

```
stellar-analytics-dashboard/
├── indexer/             # Indexer service (runtime source)
│   └── src/
├── packages/
│   ├── api/             # GraphQL API server
│   │   └── src/
│   ├── e2e/             # End-to-end tests
│   └── indexer/
│       └── migrations/  # SQL migrations
├── frontend/            # React dashboard (Vite)
│   └── src/
├── shared/              # Shared types and utilities
│   └── src/
├── docker-compose.yml
├── docker-compose.dev.yml
└── README.md
```

See [`docs/architecture.md`](./docs/architecture.md) for canonical paths and system diagrams.

## 🛠️ Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

- Follow the existing code style
- Add tests for new functionality
- Update documentation as needed

### 3. Run Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @stellar-analytics/api test

# Run with coverage
pnpm test --coverage
```

### 4. Lint and Format

```bash
# Lint all packages
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format
```

### 5. Commit Changes

Use conventional commit messages:

```
feat: add new feature
fix: resolve bug in transaction processing
docs: update API documentation
style: format code with prettier
refactor: improve database query performance
test: add unit tests for account service
chore: update dependencies
```

### 6. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Open a Pull Request with a clear description of your changes.

## 📋 Coding Standards

### TypeScript

- Use strict TypeScript configuration
- Provide explicit types for all functions
- Prefer interfaces over types for object shapes
- Use proper generic types

### Code Style

- Follow ESLint configuration
- Use Prettier for formatting
- Keep functions small and focused
- Use descriptive variable and function names

### Testing

- Write unit tests for all new functions
- Test edge cases and error conditions
- Use meaningful test descriptions
- Mock external dependencies

### Documentation

- Update README for user-facing changes
- Add JSDoc comments for complex functions
- Document GraphQL schema changes
- Include examples in API documentation

## 🧪 Testing Guidelines

### Unit Tests

```typescript
// Example test
import { describe, it, expect } from '@jest/globals'
import { formatAsset } from '../utils/stellar'

describe('formatAsset', () => {
  it('should format native asset correctly', () => {
    const asset = { asset_type: 'native' }
    expect(formatAsset(asset)).toBe('XLM')
  })

  it('should format credit asset correctly', () => {
    const asset = {
      asset_type: 'credit_alphanum4',
      asset_code: 'USD',
      asset_issuer: 'GB...'
    }
    expect(formatAsset(asset)).toBe('USD:GB...')
  })
})
```

### Integration Tests

- Test database interactions
- Test API endpoints
- Test real-time subscriptions
- Use test database fixtures

### E2E Tests

- Test user workflows
- Test real-time updates
- Use Playwright or Cypress

## 📦 Package Development

### Adding New Dependencies

```bash
# Add to specific package
pnpm --filter @stellar-analytics/api add graphql

# Add to all packages
pnpm add -w typescript

# Add dev dependency
pnpm --filter @stellar-analytics/frontend add -D @types/react
```

### Building Packages

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @stellar-analytics/shared build
```

## 🔧 Database Changes

### Schema Updates

1. Create a new migration:
   ```bash
   pnpm db:migrate:create describe_your_change
   ```
2. Implement `exports.up` and `exports.down` in `packages/indexer/migrations/`
3. Update `packages/indexer/src/database/schema.sql` as a reference snapshot (optional)
4. Update TypeScript types in shared package when needed
5. Test migrate up/down locally before opening a PR

See `docs/database-migrations.md` for rollback, CI, and production guidance.

### Testing Database Changes

```bash
# Reset database
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d

# Run migrations
pnpm db:migrate
pnpm db:migrate:down
pnpm db:migrate
```

## 🚀 Deployment

### Staging

- Deploy to staging environment for testing
- Run integration tests against staging
- Verify performance and functionality

### Production

- Create release branch
- Update version numbers
- Deploy with Docker Compose
- Monitor for issues

## 📝 Documentation

### API Documentation

- Update GraphQL schema documentation
- Add examples for new queries
- Document new resolvers

### User Documentation

- Update README for new features
- Add troubleshooting guides
- Update configuration examples

## 👥 Code Ownership

Each service area has a designated owning team. GitHub automatically requests their review via [`.github/CODEOWNERS`](.github/CODEOWNERS) whenever a PR touches their files.

See [`docs/code-ownership.md`](docs/code-ownership.md) for the full ownership table, per-area acceptance criteria, and escalation guidelines.

## Issue taxonomy

Use the labels, areas, and title conventions in [`docs/contributor-issue-taxonomy.md`](docs/contributor-issue-taxonomy.md) when filing or triaging issues. Every new feature request starts with `needs-triage` and must identify affected monorepo areas.

## 📦 Dependency Updates

Third-party packages are kept current via Dependabot, which opens grouped PRs every Monday at 06:00 UTC. Security advisories are handled immediately regardless of the weekly schedule.

See [`docs/dependency-management.md`](docs/dependency-management.md) for the full update policy, review checklist, and instructions for manual updates.

## 🤝 Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow

### Getting Help

- Ask questions in GitHub Discussions
- Join our Discord community
- Check existing issues before creating new ones

## 🏆 Recognition

Contributors will be recognized in:

- README contributors section
- Release notes
- Community highlights

## 📋 Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Code follows project style guidelines
- [ ] All tests pass
- [ ] New functionality is tested
- [ ] Documentation is updated
- [ ] Commit messages are conventional
- [ ] No sensitive data is committed
- [ ] PR description is clear and detailed

## 🐛 Bug Reports

When reporting bugs, include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Error messages and logs

## 💡 Feature Requests



Thank you for contributing to Stellar Analytics Dashboard! 🎉
