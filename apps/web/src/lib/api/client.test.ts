import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { buildUrl, createApiClient } from './client';
import { ApiError, userMessage } from './errors';

const request = createApiClient('http://gateway.test');

function mockFetch(response: Response) {
  const fn = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildUrl', () => {
  it('prefixes the API version and drops empty query values', () => {
    expect(
      buildUrl('http://gw.test/', '/products', { q: 'forge', page: 2, brand: '', x: undefined }),
    ).toBe('http://gw.test/api/v1/products?q=forge&page=2');
  });
});

describe('api client', () => {
  it('sends JSON with a request id and credentials, and validates the response', async () => {
    const fetchMock = mockFetch(Response.json({ id: 'x' }));
    const result = await request('/cart/items', {
      method: 'POST',
      body: { a: 1 },
      schema: z.object({ id: z.string() }),
    });
    expect(result).toEqual({ id: 'x' });
    const [, init] = fetchMock.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(init?.credentials).toBe('include');
    expect(init?.body).toBe('{"a":1}');
  });

  it('rejects responses that violate the schema', async () => {
    mockFetch(Response.json({ id: 42 }));
    await expect(request('/x', { schema: z.object({ id: z.string() }) })).rejects.toThrow();
  });

  it('turns the standard error body into an ApiError', async () => {
    mockFetch(
      Response.json(
        {
          error: {
            code: 'PRODUCT_OUT_OF_STOCK',
            message: 'Product is currently out of stock',
            requestId: 'req-1',
          },
        },
        { status: 409 },
      ),
    );
    const error = await request('/cart/items', { method: 'POST', schema: z.unknown() }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'PRODUCT_OUT_OF_STOCK', requestId: 'req-1' });
    expect(userMessage(error)).toBe('Product is currently out of stock');
  });

  it('hides server error details from shoppers', async () => {
    mockFetch(new Response('<html>Bad gateway</html>', { status: 502 }));
    const error = await request('/x', { schema: z.unknown() }).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
    expect(userMessage(error)).toBe('Something went wrong on our side. Please try again.');
  });
});
