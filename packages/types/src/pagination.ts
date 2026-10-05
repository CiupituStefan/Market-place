import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(24),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginate<T>(items: T[], total: number, query: PaginationQuery): Paginated<T> {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export function toOffset(query: PaginationQuery): { offset: number; limit: number } {
  return { offset: (query.page - 1) * query.pageSize, limit: query.pageSize };
}
