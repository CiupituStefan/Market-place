import { FILTER_KEYS, type CatalogQuery, type Facet, type FilterKey } from '@market/types';
import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  inArray,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { DATABASE, type Database } from '../db/database.js';
import { categories, productAttributes, products } from '../db/schema.js';
import type { CatalogSearch, SearchResult } from './catalog-search.js';

/** Minimum trigram word similarity for typo-tolerant matches ("keybaord" → "keyboard"). */
const FUZZY_THRESHOLD = 0.4;

/**
 * Turns user input into a safe prefix tsquery: only letters and digits survive,
 * so the query syntax cannot be injected ("forge 75" → "forge:* & 75:*").
 */
export function toPrefixTsQuery(input: string): string | null {
  const tokens = input
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8);
  return tokens.length > 0 ? tokens.map((token) => `${token}:*`).join(' & ') : null;
}

@Injectable()
export class PostgresCatalogSearch implements CatalogSearch {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async search(query: CatalogQuery): Promise<SearchResult> {
    const base = await this.baseConditions(query);
    if (!base) return { ids: [], total: 0, facets: [] };

    const where = and(...base, ...this.filterConditions(query));
    const offset = (query.page - 1) * query.pageSize;
    const [rows, totals, facets] = await Promise.all([
      this.db
        .select({ id: products.id })
        .from(products)
        .where(where)
        .orderBy(...this.ordering(query))
        .limit(query.pageSize)
        .offset(offset),
      this.db.select({ total: count() }).from(products).where(where),
      this.facets(query, base),
    ]);
    return { ids: rows.map((row) => row.id), total: totals[0]?.total ?? 0, facets };
  }

  /** Conditions shared by results and facets: published, category scope, search text. */
  private async baseConditions(query: CatalogQuery): Promise<SQL[] | null> {
    const conditions: SQL[] = [eq(products.status, 'PUBLISHED')];

    if (query.category) {
      const scope = await this.db
        .select({ id: categories.id })
        .from(categories)
        .where(
          or(
            eq(categories.slug, query.category),
            inArray(
              categories.parentId,
              this.db
                .select({ id: categories.id })
                .from(categories)
                .where(eq(categories.slug, query.category)),
            ),
          ),
        );
      if (scope.length === 0) return null;
      conditions.push(
        inArray(
          products.categoryId,
          scope.map((row) => row.id),
        ),
      );
    }

    if (query.q) {
      const tsQuery = toPrefixTsQuery(query.q);
      const term = query.q.toLowerCase();
      const matches: SQL[] = [
        sql`word_similarity(${term}, ${products.searchDocument}) >= ${FUZZY_THRESHOLD}`,
      ];
      if (tsQuery)
        matches.unshift(sql`${products.searchVector} @@ to_tsquery('simple', ${tsQuery})`);
      // Exact substring (e.g. a full SKU), with LIKE wildcards escaped.
      matches.push(
        sql`${products.searchDocument} LIKE ${`%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`}`,
      );
      // At least one alternative always exists, so `or` never returns undefined here.
      conditions.push(sql`(${sql.join(matches, sql` OR `)})`);
    }
    return conditions;
  }

  private filterConditions(query: CatalogQuery, skip?: FilterKey): SQL[] {
    const conditions: SQL[] = [];
    for (const { key } of FILTER_KEYS) {
      const values = query[key];
      if (key === skip || values.length === 0) continue;
      // OR within one facet, AND across facets.
      conditions.push(
        exists(
          this.db
            .select({ one: sql`1` })
            .from(productAttributes)
            .where(
              and(
                eq(productAttributes.productId, products.id),
                eq(productAttributes.key, key),
                inArray(productAttributes.value, values),
              ),
            ),
        ),
      );
    }
    if (query.inStock) conditions.push(ne(products.availability, 'OUT_OF_STOCK'));
    if (query.minPrice !== undefined)
      conditions.push(gte(products.minPriceAmount, query.minPrice * 100));
    if (query.maxPrice !== undefined)
      conditions.push(lte(products.minPriceAmount, query.maxPrice * 100));
    return conditions;
  }

  private ordering(query: CatalogQuery): SQL[] {
    const stable = asc(products.id);
    switch (query.sort) {
      case 'newest':
        return [sql`${products.publishedAt} DESC NULLS LAST`, desc(products.createdAt), stable];
      case 'price-asc':
        return [sql`${products.minPriceAmount} ASC NULLS LAST`, stable];
      case 'price-desc':
        return [sql`${products.minPriceAmount} DESC NULLS LAST`, stable];
      case 'rating':
        return [desc(products.ratingAverage), desc(products.ratingCount), stable];
      case 'featured':
        if (query.q) {
          const tsQuery = toPrefixTsQuery(query.q);
          const rank = tsQuery
            ? sql`ts_rank(${products.searchVector}, to_tsquery('simple', ${tsQuery}))`
            : sql`0`;
          return [
            sql`${rank} + word_similarity(${query.q.toLowerCase()}, ${products.searchDocument}) DESC`,
            stable,
          ];
        }
        return [sql`${products.featuredRank} ASC NULLS LAST`, desc(products.ratingCount), stable];
    }
  }

  /**
   * Counts per attribute value. Each facet ignores its own selection so shoppers
   * can still see (and add) sibling values; it respects every other filter.
   */
  private async facets(query: CatalogQuery, base: SQL[]): Promise<Facet[]> {
    const results = await Promise.all(
      FILTER_KEYS.map(async ({ key, label }) => {
        const rows = await this.db
          .select({
            value: productAttributes.value,
            count: sql<number>`count(distinct ${products.id})::int`,
          })
          .from(products)
          .innerJoin(
            productAttributes,
            and(eq(productAttributes.productId, products.id), eq(productAttributes.key, key)),
          )
          .where(and(...base, ...this.filterConditions(query, key)))
          .groupBy(productAttributes.value);
        const counts = new Map(rows.map((row) => [row.value, row.count]));
        for (const selected of query[key]) if (!counts.has(selected)) counts.set(selected, 0);
        const values = [...counts.entries()]
          .map(([value, total]) => ({ value, count: total }))
          .sort((a, b) => a.value.localeCompare(b.value, 'en', { numeric: true }));
        return { key, label, values };
      }),
    );
    // A facet with a single option cannot narrow anything, unless the shopper selected it.
    return results.filter((facet) => facet.values.length > 1 || query[facet.key].length > 0);
  }
}
