import { describe, expect, it } from 'vitest';
import {
  ApiErrorBodySchema,
  DomainError,
  ErrorCode,
  httpStatusFor,
  toApiErrorBody,
} from './errors.js';

describe('errors', () => {
  it('maps every error code to an HTTP status', () => {
    for (const code of Object.values(ErrorCode)) {
      const status = httpStatusFor(code);
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
    }
  });

  it('builds a body that matches the public error contract', () => {
    const body = toApiErrorBody(
      ErrorCode.PRODUCT_OUT_OF_STOCK,
      'Product is currently out of stock',
      'req-123',
    );
    expect(ApiErrorBodySchema.parse(body)).toEqual({
      error: {
        code: 'PRODUCT_OUT_OF_STOCK',
        message: 'Product is currently out of stock',
        requestId: 'req-123',
      },
    });
  });

  it('exposes the status on DomainError', () => {
    const err = new DomainError(ErrorCode.INSUFFICIENT_STOCK, 'Only 1 left');
    expect(err.status).toBe(409);
    expect(err).toBeInstanceOf(Error);
  });
});
