#!/usr/bin/env tsx
/**
 * Generate GraphQL schema documentation from the active API schema.
 *
 * Outputs:
 *   docs/generated/schema.graphql   – printed SDL
 *   docs/generated/graphql-schema.md – Markdown type reference
 *
 * Usage:
 *   pnpm docs:graphql   (or: pnpm --dir api docs:graphql)
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse, print, Kind, type DefinitionNode } from 'graphql';
import { typeDefs } from '../src/schema.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT_DIR = join(ROOT, 'docs/generated');

const escapeCell = (text: string) => text.replace(/\n/g, ' ').replace(/\|/g, '\\|');

// Work from the parsed AST (not a built schema) so docs can be produced even
// while the SDL references types that are still being implemented.
const document = parse(typeDefs);

type NamedDefinition = DefinitionNode & {
  name: { value: string };
  description?: { value: string };
};
const definitions = document.definitions
  .filter((d): d is NamedDefinition => 'name' in d && d.name !== undefined)
  .sort((a, b) => a.name.value.localeCompare(b.name.value));

const lines: string[] = [
  '# GraphQL Schema Reference',
  '',
  '> Generated from `api/src/schema.ts` by `pnpm docs:graphql`. Do not edit by hand.',
  '',
];

for (const def of definitions) {
  lines.push(`## ${def.name.value}`, '');
  if (def.description) lines.push(def.description.value, '');
  if (
    def.kind === Kind.OBJECT_TYPE_DEFINITION ||
    def.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ||
    def.kind === Kind.INTERFACE_TYPE_DEFINITION
  ) {
    lines.push('| Field | Type | Description |', '| --- | --- | --- |');
    for (const field of def.fields ?? []) {
      const args =
        'arguments' in field && field.arguments?.length
          ? `(${field.arguments.map((a) => `${a.name.value}: ${print(a.type)}`).join(', ')})`
          : '';
      lines.push(
        `| \`${field.name.value}${args}\` | \`${print(field.type)}\` | ${escapeCell(field.description?.value ?? '')} |`
      );
    }
    lines.push('');
  } else if (def.kind === Kind.ENUM_TYPE_DEFINITION) {
    for (const value of def.values ?? []) lines.push(`- \`${value.name.value}\``);
    lines.push('');
  } else if (def.kind === Kind.UNION_TYPE_DEFINITION) {
    lines.push(`Union of: ${(def.types ?? []).map((t) => `\`${t.name.value}\``).join(', ')}`, '');
  } else if (def.kind === Kind.SCALAR_TYPE_DEFINITION) {
    lines.push('Custom scalar.', '');
  }
}

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(join(OUTPUT_DIR, 'schema.graphql'), print(document) + '\n');
writeFileSync(join(OUTPUT_DIR, 'graphql-schema.md'), lines.join('\n'));
console.log(`GraphQL schema docs written to ${OUTPUT_DIR}`);
