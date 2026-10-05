import {
  DomainError,
  ErrorCode,
  type CatalogQuery,
  type Category,
  type Paginated,
  type Product,
  type ProductListing,
  type ProductStatus,
  type ProductSummary,
} from '@market/types';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, inArray, ne, or } from 'drizzle-orm';
import { DATABASE, type Database } from '../db/database.js';
import {
  categories,
  productAttributes,
  productImages,
  products,
  productVariants,
  type ProductRow,
} from '../db/schema.js';
import { CATALOG_SEARCH, type CatalogSearch } from '../search/catalog-search.js';
import { groupAttributes, toCategory, toProduct, toSummary } from './mappers.js';

export interface ManagedProductSummary extends ProductSummary {
  status: ProductStatus;
  variantCount: number;
}

@Injectable()
export class CatalogReaderService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CATALOG_SEARCH) private readonly catalogSearch: CatalogSearch,
  ) {}

  async list(query: CatalogQuery): Promise<ProductListing> {
    const result = await this.catalogSearch.search(query);
    return {
      items: await this.summaries(result.ids),
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / query.pageSize)),
      facets: result.facets,
    };
  }

  async getPublishedBySlug(slug: string): Promise<Product> {
    const [row] = await this.db
      .select()
      .from(products)
      .where(and(eq(products.slug, slug), eq(products.status, 'PUBLISHED')));
    if (!row) throw new DomainError(ErrorCode.PRODUCT_NOT_FOUND, 'Product not found');
    return this.detail(row);
  }

  async getById(id: string): Promise<Product & { status: ProductStatus }> {
    const [row] = await this.db.select().from(products).where(eq(products.id, id));
    if (!row) throw new DomainError(ErrorCode.PRODUCT_NOT_FOUND, 'Product not found');
    return { ...(await this.detail(row)), status: row.status };
  }

  /** Same category first, then the most reviewed; only published products. */
  async related(slug: string, limit = 4): Promise<ProductSummary[]> {
    const [product] = await this.db
      .select({ id: products.id, categoryId: products.categoryId })
      .from(products)
      .where(and(eq(products.slug, slug), eq(products.status, 'PUBLISHED')));
    if (!product) throw new DomainError(ErrorCode.PRODUCT_NOT_FOUND, 'Product not found');
    const rows = await this.db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.status, 'PUBLISHED'), ne(products.id, product.id)))
      .orderBy(
        desc(eq(products.categoryId, product.categoryId)),
        desc(products.ratingCount),
        asc(products.id),
      )
      .limit(limit);
    return this.summaries(rows.map((row) => row.id));
  }

  async categories(): Promise<Category[]> {
    const rows = await this.db
      .select()
      .from(categories)
      .orderBy(asc(categories.position), asc(categories.name));
    const slugById = new Map(rows.map((row) => [row.id, row.slug]));
    return rows.map((row) =>
      toCategory(row, row.parentId ? (slugById.get(row.parentId) ?? null) : null),
    );
  }

  async category(slug: string): Promise<Category> {
    const category = (await this.categories()).find((c) => c.slug === slug);
    if (!category) throw new DomainError(ErrorCode.NOT_FOUND, 'Category not found');
    return category;
  }

  /** Back-office listing: every status, simple text filter on name/slug/brand. */
  async manageList(query: {
    page: number;
    pageSize: number;
    status?: ProductStatus | undefined;
    q?: string | undefined;
  }): Promise<Paginated<ManagedProductSummary>> {
    const term = query.q ? `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : undefined;
    const where = and(
      query.status ? eq(products.status, query.status) : undefined,
      term
        ? or(ilike(products.name, term), ilike(products.slug, term), ilike(products.brand, term))
        : undefined,
    );
    const [rows, totals] = await Promise.all([
      this.db
        .select({ id: products.id, status: products.status })
        .from(products)
        .where(where)
        .orderBy(desc(products.updatedAt), asc(products.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db.select({ total: count() }).from(products).where(where),
    ]);
    const ids = rows.map((row) => row.id);
    const [summaries, variantCounts] = await Promise.all([
      this.summaries(ids),
      ids.length
        ? this.db
            .select({ productId: productVariants.productId, total: count() })
            .from(productVariants)
            .where(inArray(productVariants.productId, ids))
            .groupBy(productVariants.productId)
        : Promise.resolve([]),
    ]);
    const statusById = new Map(rows.map((row) => [row.id, row.status]));
    const variantsById = new Map(variantCounts.map((row) => [row.productId, row.total]));
    const total = totals[0]?.total ?? 0;
    return {
      items: summaries.map((summary) => ({
        ...summary,
        status: statusById.get(summary.id) ?? 'DRAFT',
        variantCount: variantsById.get(summary.id) ?? 0,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  /** Loads summaries for ids, preserving the given order. */
  async summaries(ids: readonly string[]): Promise<ProductSummary[]> {
    if (ids.length === 0) return [];
    const [rows, images, attributes] = await Promise.all([
      this.db
        .select({ product: products, categorySlug: categories.slug })
        .from(products)
        .innerJoin(categories, eq(categories.id, products.categoryId))
        .where(inArray(products.id, [...ids])),
      this.db
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, [...ids]))
        .orderBy(asc(productImages.position)),
      this.db
        .select({
          productId: productAttributes.productId,
          key: productAttributes.key,
          value: productAttributes.value,
        })
        .from(productAttributes)
        .where(inArray(productAttributes.productId, [...ids])),
    ]);
    const byId = new Map(rows.map((row) => [row.product.id, row]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      if (!row) return [];
      return [
        toSummary(
          row.product,
          row.categorySlug,
          images.filter((image) => image.productId === id),
          groupAttributes(attributes.filter((attribute) => attribute.productId === id)),
        ),
      ];
    });
  }

  private async detail(row: ProductRow): Promise<Product> {
    const [category, variants, images, attributes] = await Promise.all([
      this.db
        .select({ slug: categories.slug })
        .from(categories)
        .where(eq(categories.id, row.categoryId)),
      this.db.select().from(productVariants).where(eq(productVariants.productId, row.id)),
      this.db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, row.id))
        .orderBy(asc(productImages.position)),
      this.db
        .select({ key: productAttributes.key, value: productAttributes.value })
        .from(productAttributes)
        .where(eq(productAttributes.productId, row.id)),
    ]);
    return toProduct(row, category[0]?.slug ?? '', variants, images, groupAttributes(attributes));
  }
}
