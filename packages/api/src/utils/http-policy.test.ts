import {
  DEFAULT_BODY_LIMIT,
  DEFAULT_REQUEST_TIMEOUT_MS,
  getBodyLimit,
  getRequestTimeoutMs,
  isIntrospectionAllowed,
  payloadTooLargeHandler,
} from './http-policy';

describe('http-policy', () => {
  it('uses the default body limit unless API_BODY_LIMIT is set', () => {
    expect(getBodyLimit({})).toBe(DEFAULT_BODY_LIMIT);
    expect(getBodyLimit({ API_BODY_LIMIT: '1mb' })).toBe('1mb');
  });

  it('responds 413 for oversized bodies and passes other errors through', () => {
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    payloadTooLargeHandler({ type: 'entity.too.large' }, {} as any, res, next);
    expect(res.status).toHaveBeenCalledWith(413);
    expect(next).not.toHaveBeenCalled();

    const other = new Error('boom');
    payloadTooLargeHandler(other, {} as any, res, next);
    expect(next).toHaveBeenCalledWith(other);
  });

  it('uses the default request timeout unless a valid API_REQUEST_TIMEOUT_MS is set', () => {
    expect(getRequestTimeoutMs({})).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
    expect(getRequestTimeoutMs({ API_REQUEST_TIMEOUT_MS: '5000' })).toBe(5000);
    expect(getRequestTimeoutMs({ API_REQUEST_TIMEOUT_MS: 'abc' })).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
    expect(getRequestTimeoutMs({ API_REQUEST_TIMEOUT_MS: '0' })).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
  });

  it('disables introspection in production unless explicitly allowed', () => {
    expect(isIntrospectionAllowed({ NODE_ENV: 'development' })).toBe(true);
    expect(isIntrospectionAllowed({ NODE_ENV: 'production' })).toBe(false);
    expect(isIntrospectionAllowed({ NODE_ENV: 'production', ALLOW_INTROSPECTION: 'true' })).toBe(
      true
    );
    expect(isIntrospectionAllowed({ NODE_ENV: 'development', ALLOW_INTROSPECTION: 'false' })).toBe(
      false
    );
  });
});
