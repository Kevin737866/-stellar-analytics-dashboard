import {
  resolveMaxQueryDepth,
  DEFAULT_MAX_QUERY_DEPTH,
  MIN_QUERY_DEPTH,
  MAX_QUERY_DEPTH_CEILING,
} from '../utils/graphql-depth';

describe('resolveMaxQueryDepth', () => {
  it('returns the default when unset or empty', () => {
    expect(resolveMaxQueryDepth(undefined)).toBe(DEFAULT_MAX_QUERY_DEPTH);
    expect(resolveMaxQueryDepth('  ')).toBe(DEFAULT_MAX_QUERY_DEPTH);
  });

  it('uses a valid configured value', () => {
    expect(resolveMaxQueryDepth('7')).toBe(7);
  });

  it('falls back to the default for non-integer values', () => {
    expect(resolveMaxQueryDepth('abc')).toBe(DEFAULT_MAX_QUERY_DEPTH);
    expect(resolveMaxQueryDepth('4.5')).toBe(DEFAULT_MAX_QUERY_DEPTH);
  });

  it('clamps values outside the allowed range', () => {
    expect(resolveMaxQueryDepth('0')).toBe(MIN_QUERY_DEPTH);
    expect(resolveMaxQueryDepth('500')).toBe(MAX_QUERY_DEPTH_CEILING);
  });
});
