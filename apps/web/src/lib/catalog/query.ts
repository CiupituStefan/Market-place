import { z } from 'zod';
import { SORT_OPTIONS, type SortOption } from './schemas';

/** Attribute keys exposed as filters, in display order. */
export const FILTER_KEYS = [
  { key: 'brand', label: 'Brand' },
  { key: 'layout', label: 'Layout' },
  { key: 'switchType', label: 'Switch type' },
  { key: 'connection', label: 'Connection' },
  { key: 'mount', label: 'Mounting' },
  { key: 'profile', label: 'Profile' },
  { key: 'material', label: 'Material' },
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number]['key'];

const sortValues = SORT_OPTIONS.map((option) => option.value) as [SortOption, ...SortOption[]];

const list = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) =>
    (Array.isArray(value) ? value : value ? value.split(',') : [])
      .map((v) => v.trim())
      .filter(Boolean),
  );

/**
 * Parses URL search params into a catalog query. Invalid values fall back to
 * defaults instead of erroring: URLs are user-editable and get shared around.
 */
export const CatalogQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  sort: z.enum(sortValues).default('featured').catch('featured'),
  page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
  inStock: z
    .enum(['1', 'true'])
    .optional()
    .transform((value) => value !== undefined)
    .catch(false),
  /** Price bounds in major currency units (e.g. euros), as typed by shoppers. */
  /** Price bounds in major currency units (e.g. euros), as typed by shoppers. */
  minPrice: z.coerce.number().int().min(0).optional().catch(undefined),
  maxPrice: z.coerce.number().int().min(0).optional().catch(undefined),
  brand: list.catch([]),
  layout: list.catch([]),
  switchType: list.catch([]),
  connection: list.catch([]),
  mount: list.catch([]),
  profile: list.catch([]),
  material: list.catch([]),
});
export type CatalogQuery = z.infer<typeof CatalogQuerySchema>;

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseCatalogQuery(params: RawSearchParams): CatalogQuery {
  return CatalogQuerySchema.parse(params);
}

/** Serialises a query back to a URL search string, omitting defaults. */
export function toSearchParams(query: Partial<CatalogQuery>): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.sort && query.sort !== 'featured') params.set('sort', query.sort);
  if (query.page && query.page > 1) params.set('page', String(query.page));
  if (query.inStock) params.set('inStock', '1');
  if (query.minPrice !== undefined) params.set('minPrice', String(query.minPrice));
  if (query.maxPrice !== undefined) params.set('maxPrice', String(query.maxPrice));
  for (const { key } of FILTER_KEYS) {
    const values = query[key];
    if (values && values.length > 0) params.set(key, values.join(','));
  }
  return params;
}

export function activeFilterCount(query: CatalogQuery): number {
  return (
    FILTER_KEYS.reduce((total, { key }) => total + query[key].length, 0) +
    (query.inStock ? 1 : 0) +
    (query.minPrice !== undefined || query.maxPrice !== undefined ? 1 : 0)
  );
}
