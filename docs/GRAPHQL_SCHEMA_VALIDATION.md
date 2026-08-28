# GraphQL Schema Validation

This document describes the GraphQL schema validation process for the Stellar Analytics Dashboard.

## Overview

The CI pipeline validates that:
1. The API schema is valid GraphQL SDL
2. Frontend GraphQL queries are syntactically correct
3. Frontend queries use fields defined in the API schema
4. No queries reference deprecated fields

## Files

### API Schema (`packages/api/src/schema.ts`)
Contains the GraphQL SDL definition for the entire API. This is the source of truth for all GraphQL types, queries, and mutations.

### Frontend Queries (`packages/frontend/src/graphql/queries.ts`)
Contains all GraphQL queries used by the frontend. Each query is defined using the `gql` template literal tag.

## Validation Script

The `scripts/validate-graphql-schemas.ts` script performs the validation:

### Usage

```bash
# Run validation (development)
pnpm exec tsx scripts/validate-graphql-schemas.ts

# Run with verbose output
cross-env SLOW_MODE=true pnpm exec tsx scripts/validate-graphql-schemas.ts

# CI mode (for CI/CD pipelines)
pnpm run test:schema:ci
```

### What It Validates

1. **Schema Syntax**: Parses and validates the API schema against GraphQL spec rules
2. **Query Parsing**: Ensures all frontend queries can be parsed as valid GraphQL
3. **Unique Operations**: Verifies all operation names are unique
4. **Naming Conventions**: Checks that queries start with "Get" or "Search"
5. **Schema Completeness**: Ensures required types (Query, Subscription) exist

## CI Workflow

The `graphql-schema-validation.yml` workflow runs on every push and pull request to `main` and `develop` branches.

### Jobs

- **schema-validation**: Runs the validation script and reports results

### Output

- GitHub check with validation status
- PR comments with test summary
- GitHub Actions step summary with details

## Test Coverage

### Unit Tests (`scripts/__tests__/validate-graphql-schemas.test.ts`)

The test suite includes:

#### Schema Validation Tests
- Schema file exists and is readable
- Contains valid GraphQL SDL
- Can be parsed as valid GraphQL document
- Has required types (Query, Ledger, Transaction, etc.)
- Passes GraphQL spec validation
- Query type has fields
- Query type includes core endpoints
- Defines subscription type
- Includes time range enum
- Includes input types

#### Frontend Query Tests
- queries.ts exists and is readable
- Contains gql tagged template literals
- Contains named GraphQL operations
- Queries can be parsed
- Have unique operation names
- Follow naming conventions

## Running Tests

```bash
# Run all tests
pnpm test

# Run schema validation tests
pnpm test:scripts:validate-graphql-schemas

# Run with coverage
pnpm test --coverage
```

## Troubleshooting

### Schema Validation Fails

**Error**: "Failed to parse schema.ts"

- **Cause**: Schema.ts may have syntax errors or missing template literal
- **Fix**: Check `packages/api/src/schema.ts` for proper SDL syntax

**Error**: "Could not extract GraphQL SDL from schema.ts"

- **Cause**: The `typeDefs` export format may have changed
- **Fix**: Ensure the export follows the template literal pattern:
  ```typescript
  export const typeDefs = /* GraphQL */ `
    type Query {
      # ... fields
    }
  `;
  ```

### Query Validation Fails

**Error**: "Failed to parse query"

- **Cause**: The GraphQL query may have syntax errors
- **Fix**: Check the specific query in `packages/frontend/src/graphql/queries.ts`

**Error**: "Operation name already exists"

- **Cause**: Duplicate operation names across files
- **Fix**: Ensure all operation names are unique

## Best Practices

1. **Update Schema First**: Modify the API schema before updating frontend queries
2. **Run Validation Locally**: Run `pnpm exec tsx scripts/validate-graphql-schemas.ts` before committing
3. **Use Unique Names**: All operations should have descriptive, unique names
4. **Test in Development**: Verify queries work in the playground before committing

## Related Documentation

- [GraphQL Query Standards](./graphql-query-standards.md)
- [API Examples](./api-examples.md)
- [CI Operational Notes](./CI_OPERATIONAL_NOTES.md)
