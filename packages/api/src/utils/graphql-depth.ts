export const DEFAULT_MAX_QUERY_DEPTH = 10;
export const MIN_QUERY_DEPTH = 1;
export const MAX_QUERY_DEPTH_CEILING = 50;

/**
 * Resolves the maximum allowed GraphQL query depth from GRAPHQL_MAX_DEPTH.
 * Falls back to the default when unset or invalid; clamps to a safe range.
 */
export function resolveMaxQueryDepth(
  raw: string | undefined = process.env.GRAPHQL_MAX_DEPTH
): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_MAX_QUERY_DEPTH;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return DEFAULT_MAX_QUERY_DEPTH;
  return Math.min(Math.max(parsed, MIN_QUERY_DEPTH), MAX_QUERY_DEPTH_CEILING);
}
