import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchema, parse, specifiedRules, validate } from 'graphql';
import { depthLimit } from '../depthLimit.js';
import { getClientIp } from '../clientIp.js';
import {
  MemoryRateLimitStore,
  PostgresRateLimitStore,
  checkRateLimit,
  rateLimitHeaders,
} from '../rateLimit.js';

const schema = buildSchema(`type Node { child: Node, id: ID } type Query { node: Node }`);

function nested(depth: number) {
  return (
    '{ ' + 'node { '.repeat(1) + 'child { '.repeat(depth - 2) + 'id' + ' }'.repeat(depth - 1) + ' }'
  );
}

test('depthLimit allows queries at the limit and rejects deeper ones', () => {
  const rules = [...specifiedRules, depthLimit(4)];
  assert.equal(validate(schema, parse(nested(4)), rules).length, 0);
  const errors = validate(schema, parse(nested(5)), rules);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /maximum query depth of 4/);
});

test('depthLimit follows fragments and ignores introspection fields', () => {
  const rules = [depthLimit(2)];
  const doc = parse(`query { node { ...F } } fragment F on Node { child { id } }`);
  assert.equal(validate(schema, doc, rules).length, 1);
  assert.equal(validate(schema, parse(`{ __typename node { id } }`), rules).length, 0);
});

test('getClientIp ignores X-Forwarded-For unless proxies are trusted', () => {
  assert.equal(getClientIp('1.2.3.4', '10.0.0.1', 0), '10.0.0.1');
  assert.equal(getClientIp('1.2.3.4', '::ffff:10.0.0.1', 0), '10.0.0.1');
});

test('getClientIp picks the client entry before trusted hops', () => {
  assert.equal(getClientIp('6.6.6.6, 1.2.3.4', '10.0.0.1', 1), '1.2.3.4');
  assert.equal(getClientIp('6.6.6.6, 1.2.3.4, 10.0.0.2', '10.0.0.1', 2), '1.2.3.4');
  assert.equal(getClientIp(['1.2.3.4', '[2001:db8::1]'], '10.0.0.1', 1), '2001:db8::1');
});

test('getClientIp rejects malformed or missing forwarded values', () => {
  assert.equal(getClientIp('not-an-ip', '10.0.0.1', 1), '10.0.0.1');
  assert.equal(getClientIp('1.2.3.4', '10.0.0.1', 3), '10.0.0.1');
  assert.equal(getClientIp(undefined, undefined, 1), 'unknown');
});

test('checkRateLimit blocks after the budget and resets after the window', async () => {
  const store = new MemoryRateLimitStore();
  assert.equal((await checkRateLimit(store, 'a', 2, 50)).remaining, 1);
  assert.equal((await checkRateLimit(store, 'a', 2, 50)).allowed, true);
  assert.equal((await checkRateLimit(store, 'a', 2, 50)).allowed, false);
  assert.equal((await checkRateLimit(store, 'b', 2, 50)).allowed, true);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal((await checkRateLimit(store, 'a', 2, 50)).allowed, true);
});

test('rateLimitHeaders reports budget and Retry-After when blocked', () => {
  const now = 1_000_000;
  const ok = rateLimitHeaders(
    { allowed: true, limit: 100, remaining: 99, resetAt: now + 30_500 },
    now
  );
  assert.deepEqual(ok, {
    'RateLimit-Limit': '100',
    'RateLimit-Remaining': '99',
    'RateLimit-Reset': '31',
  });
  const blocked = rateLimitHeaders(
    { allowed: false, limit: 100, remaining: 0, resetAt: now + 5_000 },
    now
  );
  assert.equal(blocked['Retry-After'], '5');
});

test('PostgresRateLimitStore creates its table once and uses an atomic upsert', async () => {
  const calls: string[] = [];
  const resetAt = new Date(Date.now() + 60_000);
  const pool = {
    query: async (text: string) => {
      calls.push(text);
      return { rows: [{ count: 3, reset_at: resetAt }] };
    },
  };
  const store = new PostgresRateLimitStore(pool as never);
  await store.increment('ip', 60_000);
  const result = await store.increment('ip', 60_000);
  assert.deepEqual(result, { count: 3, resetAt: resetAt.getTime() });
  assert.equal(calls.filter((q) => q.includes('CREATE TABLE')).length, 1);
  assert.equal(calls.filter((q) => q.includes('ON CONFLICT')).length, 2);
});
