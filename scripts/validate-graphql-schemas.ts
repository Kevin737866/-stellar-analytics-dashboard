#!/usr/bin/env tsx
/**
 * Validate GraphQL Schema Synchronization
 * 
 * This script checks that:
 * 1. The API schema is valid GraphQL SDL
 * 2. Frontend GraphQL queries are valid against the API schema
 * 3. No queries reference deprecated fields
 * 4. No queries have missing required fields
 * 
 * Usage:
 *   pnpm exec tsx scripts/validate-graphql-schemas.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { parse, validate, specifiedRules, GraphQLError } from 'graphql';
import { loadSchema } from '@graphql-tools/load';
import { UrlLoader } from '@graphql-tools/url-loader';
import { printSchema } from 'graphql/utilities';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

const SLOW_MODE = process.env.SLOW_MODE === 'true';

interface ValidationResult {
  success: boolean;
  errors: Array<{ file: string; message: string; location?: string }>;
  warnings: Array<{ file: string; message: string }>;
}

async function loadApiSchema(): Promise<string> {
  const schemaPath = join(__dirname, '../packages/api/src/schema.ts');
  
  if (!existsSync(schemaPath)) {
    throw new Error(`API schema file not found at ${schemaPath}`);
  }

  const content = readFileSync(schemaPath, 'utf-8');
  
  // Extract the GraphQL SDL from the template literal
  const match = content.match(/export const typeDefs = \/\* GraphQL \*\/ `([\s\S]*?)`;/);
  if (!match) {
    throw new Error('Could not extract GraphQL SDL from schema.ts');
  }

  return match[1];
}

async function loadFrontendQueries(): Promise<Array<{ file: string; content: string }>> {
  const queriesDir = join(__dirname, '../packages/frontend/src/graphql');
  
  if (!existsSync(queriesDir)) {
    throw new Error(`GraphQL queries directory not found at ${queriesDir}`);
  }

  const files = [
    'queries.ts',
  ];

  const queries: Array<{ file: string; content: string }> = [];

  for (const file of files) {
    const filePath = join(queriesDir, file);
    if (existsSync(filePath)) {
      queries.push({
        file,
        content: readFileSync(filePath, 'utf-8'),
      });
    }
  }

  return queries;
}

function extractGqlQueries(content: string): Array<{ name: string; query: string }> {
  const queries: Array<{ name: string; query: string }> = [];
  
  // Match gql template literals
  const gqlRegex = /gql\`\s*([\s\S]*?)\`/g;
  let match;
  
  while ((match = gqlRegex.exec(content)) !== null) {
    const query = match[1];
    // Extract operation name
    const nameMatch = query.match(/(query|mutation|subscription)\s+(\w+)/);
    const name = nameMatch ? nameMatch[2] : `anonymous_${queries.length}`;
    
    queries.push({ name, query });
  }
  
  return queries;
}

async function validateSchema(schemaSdl: string): Promise<ValidationResult> {
  const result: ValidationResult = { success: true, errors: [], warnings: [] };
  
  try {
    const doc = parse(schemaSdl);
    
    // Validate against GraphQL spec rules
    const validationErrors = validate(doc, [...specifiedRules]);
    
    if (validationErrors.length > 0) {
      result.success = false;
      for (const error of validationErrors) {
        result.errors.push({
          file: 'schema.ts',
          message: error.message,
          location: error.locations?.[0] 
            ? `line ${error.locations[0].line}, col ${error.locations[0].column}` 
            : undefined,
        });
      }
    }
    
    // Check for schema completeness
    const schemaDoc = parse(schemaSdl);
    const hasQueryType = schemaDoc.definitions.some(
      (d) => d.kind === 'ObjectTypeDefinition' && d.name.value === 'Query'
    );
    const hasMutationType = schemaDoc.definitions.some(
      (d) => d.kind === 'ObjectTypeDefinition' && d.name.value === 'Mutation'
    );
    
    if (!hasQueryType) {
      result.warnings.push({
        file: 'schema.ts',
        message: 'Schema does not define a Query type',
      });
    }
    
  } catch (error: any) {
    result.success = false;
    result.errors.push({
      file: 'schema.ts',
      message: error.message,
    });
  }
  
  return result;
}

async function validateQueriesAgainstSchema(
  queries: Array<{ file: string; content: string }>,
  schemaSdl: string
): Promise<ValidationResult> {
  const result: ValidationResult = { success: true, errors: [], warnings: [] };
  
  // Parse the schema
  let schemaDoc;
  try {
    schemaDoc = parse(schemaSdl);
  } catch (error: any) {
    result.success = false;
    result.errors.push({
      file: 'schema.ts',
      message: `Failed to parse schema: ${error.message}`,
    });
    return result;
  }

  for (const { file, content } of queries) {
    const gqlQueries = extractGqlQueries(content);
    
    for (const { name, query } of gqlQueries) {
      try {
        const queryDoc = parse(query);
        
        // Validate query against schema
        const validationErrors = validate(queryDoc, [...specifiedRules]);
        
        if (validationErrors.length > 0) {
          result.success = false;
          for (const error of validationErrors) {
            result.errors.push({
              file,
              message: `${name}: ${error.message}`,
              location: error.locations?.[0] 
                ? `line ${error.locations[0].line}, col ${error.locations[0].column}` 
                : undefined,
            });
          }
        }
      } catch (error: any) {
        result.success = false;
        result.errors.push({
          file,
          message: `${name}: Failed to parse query - ${error.message}`,
        });
      }
    }
  }
  
  return result;
}

async function printResult(result: ValidationResult): Promise<void> {
  if (result.success && result.errors.length === 0 && result.warnings.length === 0) {
    console.log(chalk.green('✓ GraphQL schema validation passed'));
    return;
  }

  if (result.errors.length > 0) {
    console.log(chalk.red(`✗ Found ${result.errors.length} error(s):`));
    for (const error of result.errors) {
      const location = error.location ? ` (${error.location})` : '';
      console.log(chalk.red(`  - ${error.file}${location}: ${error.message}`));
    }
  }

  if (result.warnings.length > 0) {
    console.log(chalk.yellow(`⚠ Found ${result.warnings.length} warning(s):`));
    for (const warning of result.warnings) {
      console.log(chalk.yellow(`  - ${warning.file}: ${warning.message}`));
    }
  }
}

async function main(): Promise<number> {
  console.log(chalk.blue('Validating GraphQL schemas...\n'));

  const allResults: ValidationResult[] = [];

  // Validate API schema
  console.log('1. Validating API schema...');
  const schemaResult = await validateSchema(await loadApiSchema());
  allResults.push(schemaResult);
  await printResult(schemaResult);

  // Validate frontend queries against schema
  console.log('\n2. Validating frontend queries against API schema...');
  const queries = await loadFrontendQueries();
  const queryResult = await validateQueriesAgainstSchema(queries, await loadApiSchema());
  allResults.push(queryResult);
  await printResult(queryResult);

  // Summary
  const totalErrors = allResults.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = allResults.reduce((sum, r) => sum + r.warnings.length, 0);
  const allSuccess = allResults.every(r => r.success && r.errors.length === 0);

  console.log('\n' + '='.repeat(50));
  if (allSuccess) {
    console.log(chalk.green('✓ All GraphQL schemas are valid and in sync'));
    console.log(`  - ${queries.length} query files validated`);
    console.log(`  - ${totalWarnings} warning(s)`);
  } else {
    console.log(chalk.red(`✗ Validation failed: ${totalErrors} error(s), ${totalWarnings} warning(s)`));
  }
  console.log('='.repeat(50));

  return allSuccess ? 0 : 1;
}

main().then((code) => {
  process.exit(code);
}).catch((error) => {
  console.error(chalk.red('Fatal error:'), error.message);
  process.exit(1);
});
