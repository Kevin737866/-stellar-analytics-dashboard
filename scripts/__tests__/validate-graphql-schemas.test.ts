import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { parse, validate, specifiedRules } from 'graphql';

const __filename = import.meta.url;
const __dirname = resolve(__filename, '..', '..');

describe('GraphQL Schema Validation', () => {
  let schemaSdl: string;
  let schemaDoc: any;
  
  beforeAll(() => {
    const schemaPath = join(__dirname, '../packages/api/src/schema.ts');
    
    if (!existsSync(schemaPath)) {
      throw new Error(`API schema file not found at ${schemaPath}`);
    }

    const content = readFileSync(schemaPath, 'utf-8');
    const match = content.match(/export const typeDefs = \/\* GraphQL \*\/ `([\s\S]*?)`;/);
    
    if (!match) {
      throw new Error('Could not extract GraphQL SDL from schema.ts');
    }

    schemaSdl = match[1];
    schemaDoc = parse(schemaSdl);
  });

  it('schema.ts exists and is readable', () => {
    const schemaPath = join(__dirname, '../packages/api/src/schema.ts');
    expect(existsSync(schemaPath)).toBe(true);
  });

  it('schema.ts contains valid GraphQL SDL', () => {
    expect(schemaSdl).toBeTruthy();
    expect(schemaSdl.length).toBeGreaterThan(100);
    expect(schemaSdl).toContain('type Query');
    expect(schemaSdl).toContain('type Ledger');
    expect(schemaSdl).toContain('type NetworkStats');
  });

  it('schema.ts can be parsed as valid GraphQL document', () => {
    expect(schemaDoc).toBeDefined();
    expect(schemaDoc.kind).toBe('Document');
    expect(schemaDoc.definitions.length).toBeGreaterThan(0);
  });

  it('schema has required types', () => {
    const typeNames = schemaDoc.definitions
      .filter((d: any) => d.kind === 'ObjectTypeDefinition')
      .map((d: any) => d.name.value);

    expect(typeNames).toContain('Query');
    expect(typeNames).toContain('Ledger');
    expect(typeNames).toContain('Transaction');
    expect(typeNames).toContain('Operation');
    expect(typeNames).toContain('NetworkStats');
  });

  it('schema passes GraphQL spec validation', () => {
    const validationErrors = validate(schemaDoc, [...specifiedRules]);
    expect(validationErrors).toHaveLength(0);
  });

  it('schema has a Query type with fields', () => {
    const queryType = schemaDoc.definitions.find(
      (d: any) => d.kind === 'ObjectTypeDefinition' && d.name.value === 'Query'
    );

    expect(queryType).toBeDefined();
    expect(queryType.fields).toBeDefined();
    expect(queryType.fields.length).toBeGreaterThan(0);
  });

  it('schema Query type includes core endpoints', () => {
    const queryType = schemaDoc.definitions.find(
      (d: any) => d.kind === 'ObjectTypeDefinition' && d.name.value === 'Query'
    );

    const fieldNames = queryType.fields.map((f: any) => f.name.value);
    
    expect(fieldNames).toContain('ledger');
    expect(fieldNames).toContain('ledgers');
    expect(fieldNames).toContain('transactions');
    expect(fieldNames).toContain('operations');
    expect(fieldNames).toContain('networkStats');
  });

  it('schema defines subscription type', () => {
    const subscriptionType = schemaDoc.definitions.find(
      (d: any) => d.kind === 'ObjectTypeDefinition' && d.name.value === 'Subscription'
    );

    expect(subscriptionType).toBeDefined();
    expect(subscriptionType.fields).toBeDefined();
  });

  it('schema includes time range enum', () => {
    const enumType = schemaDoc.definitions.find(
      (d: any) => d.kind === 'EnumTypeDefinition' && d.name.value === 'TimeRangePreset'
    );

    expect(enumType).toBeDefined();
    expect(enumType.values).toBeDefined();
    
    const enumValues = enumType.values.map((v: any) => v.name.value);
    expect(enumValues).toContain('LAST_HOUR');
    expect(enumValues).toContain('LAST_DAY');
    expect(enumValues).toContain('LAST_WEEK');
    expect(enumValues).toContain('LAST_MONTH');
  });

  it('schema includes input types', () => {
    const inputType = schemaDoc.definitions.find(
      (d: any) => d.kind === 'InputObjectTypeDefinition' && d.name.value === 'TimeRangeInput'
    );

    expect(inputType).toBeDefined();
    expect(inputType.fields).toBeDefined();
    
    const fieldNames = inputType.fields.map((f: any) => f.name.value);
    expect(fieldNames).toContain('startTime');
    expect(fieldNames).toContain('endTime');
  });
});

describe('Frontend GraphQL Queries', () => {
  let frontendQueries: Array<{ file: string; content: string; queries: Array<{ name: string; query: string }> }>;
  
  beforeAll(() => {
    const queriesPath = join(__dirname, '../packages/frontend/src/graphql/queries.ts');
    
    if (!existsSync(queriesPath)) {
      throw new Error(`Frontend queries file not found at ${queriesPath}`);
    }

    const content = readFileSync(queriesPath, 'utf-8');
    
    const queries: Array<{ name: string; query: string }> = [];
    const gqlRegex = /gql\`\s*([\s\S]*?)\`/g;
    let match;
    
    while ((match = gqlRegex.exec(content)) !== null) {
      const query = match[1];
      const nameMatch = query.match(/(query|mutation|subscription)\s+(\w+)/);
      const name = nameMatch ? nameMatch[2] : `anonymous_${queries.length}`;
      
      queries.push({ name, query });
    }

    frontendQueries = [{
      file: 'queries.ts',
      content,
      queries,
    }];
  });

  it('queries.ts exists and is readable', () => {
    const queriesPath = join(__dirname, '../packages/frontend/src/graphql/queries.ts');
    expect(existsSync(queriesPath)).toBe(true);
  });

  it('queries.ts contains gql tagged template literals', () => {
    const content = frontendQueries[0].content;
    expect(content).toContain('gql`');
    expect(frontendQueries[0].queries.length).toBeGreaterThan(0);
  });

  it('queries.ts contains named GraphQL operations', () => {
    const queries = frontendQueries[0].queries;
    
    expect(queries.length).toBeGreaterThan(0);
    
    for (const query of queries) {
      expect(query.name).toBeTruthy();
      expect(query.name.length).toBeGreaterThan(0);
    }
  });

  it('queries.ts queries can be parsed', () => {
    for (const { query } of frontendQueries[0].queries) {
      try {
        const parsed = parse(query);
        expect(parsed.kind).toBe('Document');
      } catch (error) {
        throw new Error(`Failed to parse query: ${error}`);
      }
    }
  });

  it('queries have unique operation names', () => {
    const queries = frontendQueries[0].queries;
    const names = queries.map(q => q.name);
    const uniqueNames = new Set(names);

    expect(uniqueNames.size).toBe(names.length);
  });

  it('queries follow naming conventions', () => {
    const queries = frontendQueries[0].queries;

    for (const { name, query } of queries) {
      // Query names should start with Get, Search
      if (query.trim().startsWith('query')) {
        expect(name).toMatch(/^(Get|Search)/);
      }
      // Subscription names should start with On
      if (query.trim().startsWith('subscription')) {
        expect(name).toMatch(/^On/);
      }
    }
  });
});
