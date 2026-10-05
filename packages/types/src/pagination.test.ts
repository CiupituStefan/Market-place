import { describe, expect, it } from 'vitest';
import { MAX_PAGE_SIZE, paginate, PaginationQuerySchema, toOffset } from './pagination.js';

describe('pagination', () => {
  it('applies defaults and coerces query strings', () => {
    expect(PaginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 24 });
    expect(PaginationQuerySchema.parse({ page: '3', pageSize: '10' })).toEqual({
      page: 3,
      pageSize: 10,
    });
  });

  it('caps the page size', () => {
    expect(PaginationQuerySchema.safeParse({ pageSize: MAX_PAGE_SIZE + 1 }).success).toBe(false);
  });

  it('computes offsets and total pages', () => {
    const query = { page: 3, pageSize: 10 };
    expect(toOffset(query)).toEqual({ offset: 20, limit: 10 });
    expect(paginate([], 21, query).totalPages).toBe(3);
    expect(paginate([], 0, query).totalPages).toBe(1);
  });
});
