import { enqueueEvent, isUniqueViolation } from '@market/db';
import { ProductCreatedV1, ProductUpdatedV1 } from '@market/events';
import { DomainError, ErrorCode, type ProductStatus } from '@market/types';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { APP_CONFIG, SERVICE_NAME, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import {
  categories,
  productAttributes,
  products,
  productVariants,
  type ProductRow,
  type VariantRow,
} from '../db/schema.js';
import {
  assertVariantsMatchOptions,
  buildSearchDocument,
  lowestPrice,
  rollupAvailability,
} from './derived.js';
import type {
  CategoryInput,
  CreateProductInput,
  UpdateProductInput,
  VariantInput,
  VariantUpdate,
} from './dto.js';
import { money } from './mappers.js';

const notFound = () => new DomainError(ErrorCode.PRODUCT_NOT_FOUND, 'Product not found');

/**
 * Catalog commands for the back office. Every write recomputes the denormalised
 * read fields (price from, availability, search document) and emits a
 * ProductCreated/ProductUpdated event in the same transaction.
 */
@Injectable()
export class CatalogWriterService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async create(input: CreateProductInput): Promise<string> {
    assertVariantsMatchOptions(input.options, input.variants);
    try {
      return await this.db.transaction(async (tx) => {
        const category = await this.categoryBySlug(tx, input.categorySlug);
        const currency = this.config.CATALOG_CURRENCY;
        const [product] = await tx
          .insert(products)
          .values({
            slug: input.slug,
            name: input.name,
            brand: input.brand,
            categoryId: category.id,
            kind: input.kind,
            tagline: input.tagline,
            description: input.description,
            highlights: input.highlights,
            included: input.included,
            compatibility: input.compatibility,
            faq: input.faq,
            specs: input.specs,
            badges: input.badges,
            options: input.options,
            preview: input.preview,
            featuredRank: input.featuredRank,
            currency,
          })
          .returning();
        if (!product) throw new Error('product insert returned no row');
        await tx
          .insert(productVariants)
          .values(
            input.variants.map((variant, position) =>
              this.variantValues(product.id, variant, position, input.preview),
            ),
          );
        await this.replaceAttributes(tx, product.id, input.brand, input.attributes);
        const { row, variants } = await this.refreshDerived(tx, product.id);
        await enqueueEvent(
          tx,
          ProductCreatedV1,
          {
            productId: row.id,
            slug: row.slug,
            name: row.name,
            brand: row.brand,
            categoryId: row.categoryId,
            status: 'DRAFT',
            variants: this.variantSnapshots(variants),
          },
          { producer: SERVICE_NAME, aggregateId: row.id },
        );
        return row.id;
      });
    } catch (error) {
      throw this.conflictOrRethrow(error);
    }
  }

  async update(productId: string, input: UpdateProductInput): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        const current = await this.lockProduct(tx, productId);
        const options = input.options ?? current.options;
        if (input.options) {
          const variants = await tx
            .select()
            .from(productVariants)
            .where(eq(productVariants.productId, productId));
          assertVariantsMatchOptions(options, variants);
        }
        const { categorySlug, attributes, ...fields } = input;
        const categoryId = categorySlug
          ? (await this.categoryBySlug(tx, categorySlug)).id
          : undefined;
        await tx
          .update(products)
          .set({ ...fields, ...(categoryId ? { categoryId } : {}), updatedAt: new Date() })
          .where(eq(products.id, productId));
        if (attributes || input.brand) {
          await this.replaceAttributes(
            tx,
            productId,
            input.brand ?? current.brand,
            attributes ?? (await this.currentAttributes(tx, productId)),
          );
        }
        await this.emitUpdated(tx, productId, Object.keys(input));
      });
    } catch (error) {
      throw this.conflictOrRethrow(error);
    }
  }

  async setStatus(productId: string, status: ProductStatus): Promise<void> {
    await this.db.transaction(async (tx) => {
      const current = await this.lockProduct(tx, productId);
      if (current.status === status) return;
      if (status === 'PUBLISHED' && current.minPriceAmount === null) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          'A product needs at least one variant before publishing',
        );
      }
      await tx
        .update(products)
        .set({
          status,
          updatedAt: new Date(),
          ...(status === 'PUBLISHED' && !current.publishedAt ? { publishedAt: new Date() } : {}),
        })
        .where(eq(products.id, productId));
      await this.emitUpdated(tx, productId, ['status']);
    });
  }

  async addVariant(productId: string, input: VariantInput): Promise<string> {
    try {
      return await this.db.transaction(async (tx) => {
        const product = await this.lockProduct(tx, productId);
        const existing = await tx
          .select()
          .from(productVariants)
          .where(eq(productVariants.productId, productId));
        assertVariantsMatchOptions(product.options, [...existing, input]);
        const [variant] = await tx
          .insert(productVariants)
          .values(this.variantValues(productId, input, existing.length, product.preview))
          .returning({ id: productVariants.id });
        await this.emitUpdated(tx, productId, ['variants']);
        if (!variant) throw new Error('variant insert returned no row');
        return variant.id;
      });
    } catch (error) {
      throw this.conflictOrRethrow(error);
    }
  }

  async updateVariant(productId: string, variantId: string, input: VariantUpdate): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.lockProduct(tx, productId);
      const [variant] = await tx
        .select()
        .from(productVariants)
        .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)));
      if (!variant) throw new DomainError(ErrorCode.VARIANT_NOT_FOUND, 'Variant not found');
      const price = input.price ?? variant.priceAmount;
      const compareAt =
        input.compareAtPrice === undefined ? variant.compareAtAmount : input.compareAtPrice;
      if (compareAt !== null && compareAt <= price) {
        throw new DomainError(
          ErrorCode.VALIDATION_FAILED,
          'Compare-at price must be higher than the price',
          [{ path: 'compareAtPrice', message: 'Must be higher than the price' }],
        );
      }
      await tx
        .update(productVariants)
        .set({
          priceAmount: price,
          compareAtAmount: compareAt,
          ...(input.availability ? { availability: input.availability } : {}),
          ...(input.preview ? { preview: input.preview } : {}),
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, variantId));
      await this.emitUpdated(tx, productId, ['variants']);
    });
  }

  async removeVariant(productId: string, variantId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const product = await this.lockProduct(tx, productId);
      const variants = await tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, productId));
      if (!variants.some((v) => v.id === variantId)) {
        throw new DomainError(ErrorCode.VARIANT_NOT_FOUND, 'Variant not found');
      }
      if (variants.length === 1 && product.status === 'PUBLISHED') {
        throw new DomainError(
          ErrorCode.CONFLICT,
          'A published product must keep at least one variant',
        );
      }
      await tx.delete(productVariants).where(eq(productVariants.id, variantId));
      await this.emitUpdated(tx, productId, ['variants']);
    });
  }

  async createCategory(input: CategoryInput): Promise<string> {
    try {
      return await this.db.transaction(async (tx) => {
        const parentId = input.parentSlug
          ? (await this.categoryBySlug(tx, input.parentSlug)).id
          : null;
        const [row] = await tx
          .insert(categories)
          .values({
            slug: input.slug,
            name: input.name,
            description: input.description,
            parentId,
            preview: input.preview,
            position: input.position,
          })
          .returning({ id: categories.id });
        if (!row) throw new Error('category insert returned no row');
        return row.id;
      });
    } catch (error) {
      throw this.conflictOrRethrow(error);
    }
  }

  async updateCategory(categoryId: string, input: Partial<CategoryInput>): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        const { parentSlug, ...fields } = input;
        let parentId: string | null | undefined;
        if (parentSlug !== undefined) {
          parentId = parentSlug ? (await this.categoryBySlug(tx, parentSlug)).id : null;
          if (parentId === categoryId)
            throw new DomainError(ErrorCode.CONFLICT, 'A category cannot be its own parent');
        }
        const [row] = await tx
          .update(categories)
          .set({
            ...fields,
            ...(parentId !== undefined ? { parentId } : {}),
            updatedAt: new Date(),
          })
          .where(eq(categories.id, categoryId))
          .returning({ id: categories.id });
        if (!row) throw new DomainError(ErrorCode.NOT_FOUND, 'Category not found');
      });
    } catch (error) {
      throw this.conflictOrRethrow(error);
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /**
   * Projects inventory-service's stock level onto a variant (InventoryStockChanged,
   * inside the consumer's inbox transaction). A pre-order variant stays PREORDER
   * while nothing is in stock. No ProductUpdated is emitted: stock levels are not
   * catalog changes, and inventory-service already announced them.
   * Returns whether anything changed.
   */
  async applyStockLevel(
    tx: Database,
    variantId: string,
    availability: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK',
  ): Promise<boolean> {
    const [variant] = await tx
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
      .for('update');
    if (!variant) return false; // removed from the catalog meanwhile
    const next =
      variant.availability === 'PREORDER' && availability === 'OUT_OF_STOCK'
        ? 'PREORDER'
        : availability;
    if (next === variant.availability) return false;
    await tx
      .update(productVariants)
      .set({ availability: next })
      .where(eq(productVariants.id, variantId));
    await this.refreshDerived(tx, variant.productId);
    return true;
  }

  private async lockProduct(tx: Database, productId: string): Promise<ProductRow> {
    const [row] = await tx.select().from(products).where(eq(products.id, productId)).for('update');
    if (!row) throw notFound();
    if (row.status === 'ARCHIVED')
      throw new DomainError(ErrorCode.CONFLICT, 'Archived products cannot be changed');
    return row;
  }

  private async categoryBySlug(tx: Database, slug: string) {
    const [category] = await tx.select().from(categories).where(eq(categories.slug, slug));
    if (!category) {
      throw new DomainError(ErrorCode.VALIDATION_FAILED, 'Unknown category', [
        { path: 'categorySlug', message: `No category "${slug}"` },
      ]);
    }
    return category;
  }

  private variantValues(
    productId: string,
    variant: VariantInput,
    position: number,
    fallbackPreview: ProductRow['preview'],
  ) {
    return {
      productId,
      sku: variant.sku,
      options: variant.options,
      priceAmount: variant.price,
      compareAtAmount: variant.compareAtPrice,
      currency: this.config.CATALOG_CURRENCY,
      availability: variant.availability,
      preview: variant.preview ?? fallbackPreview,
      position,
    };
  }

  private async currentAttributes(
    tx: Database,
    productId: string,
  ): Promise<Record<string, string[]>> {
    const rows = await tx
      .select()
      .from(productAttributes)
      .where(eq(productAttributes.productId, productId));
    const attributes: Record<string, string[]> = {};
    for (const row of rows) if (row.key !== 'brand') (attributes[row.key] ??= []).push(row.value);
    return attributes;
  }

  /** Brand is always filterable, so it is stored as an attribute too. */
  private async replaceAttributes(
    tx: Database,
    productId: string,
    brand: string,
    attributes: Record<string, string[]>,
  ): Promise<void> {
    await tx.delete(productAttributes).where(eq(productAttributes.productId, productId));
    const rows = Object.entries({ ...attributes, brand: [brand] }).flatMap(([key, values]) =>
      [...new Set(values)].map((value) => ({ productId, key, value })),
    );
    if (rows.length > 0) await tx.insert(productAttributes).values(rows);
  }

  /** Recomputes price-from, availability and the search document. */
  private async refreshDerived(
    tx: Database,
    productId: string,
  ): Promise<{ row: ProductRow; variants: VariantRow[] }> {
    const [product] = await tx.select().from(products).where(eq(products.id, productId));
    if (!product) throw notFound();
    // Sequential on purpose: a transaction is one connection, which runs one query at a time.
    const variants = await tx
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId))
      .orderBy(asc(productVariants.position));
    const attributes = await tx
      .select()
      .from(productAttributes)
      .where(eq(productAttributes.productId, productId));
    const categoryNames = await tx
      .select({ name: categories.name })
      .from(categories)
      .where(
        or(
          eq(categories.id, product.categoryId),
          inArray(
            categories.id,
            tx
              .select({ parentId: categories.parentId })
              .from(categories)
              .where(eq(categories.id, product.categoryId)),
          ),
        ),
      );
    const grouped: Record<string, string[]> = {};
    for (const attribute of attributes) (grouped[attribute.key] ??= []).push(attribute.value);
    const price = lowestPrice(variants);
    const [row] = await tx
      .update(products)
      .set({
        minPriceAmount: price?.amount ?? null,
        minPriceCompareAtAmount: price?.compareAt ?? null,
        availability: rollupAvailability(variants),
        searchDocument: buildSearchDocument({
          name: product.name,
          brand: product.brand,
          tagline: product.tagline,
          categoryNames: categoryNames.map((c) => c.name),
          skus: variants.map((v) => v.sku),
          attributes: grouped,
        }),
      })
      .where(eq(products.id, productId))
      .returning();
    if (!row) throw notFound();
    return { row, variants };
  }

  private async emitUpdated(
    tx: Database,
    productId: string,
    changedFields: string[],
  ): Promise<void> {
    const { row, variants } = await this.refreshDerived(tx, productId);
    await enqueueEvent(
      tx,
      ProductUpdatedV1,
      {
        productId: row.id,
        slug: row.slug,
        name: row.name,
        status: row.status,
        variants: this.variantSnapshots(variants),
        changedFields,
      },
      { producer: SERVICE_NAME, aggregateId: row.id },
    );
  }

  private variantSnapshots(variants: VariantRow[]) {
    return variants.map((variant) => ({
      variantId: variant.id,
      sku: variant.sku,
      price: money(variant.priceAmount, variant.currency),
      attributes: variant.options,
    }));
  }

  private conflictOrRethrow(error: unknown): unknown {
    if (!isUniqueViolation(error)) return error;
    const text = String(error instanceof Error ? `${error.message} ${String(error.cause)}` : error);
    if (text.includes('sku'))
      return new DomainError(ErrorCode.CONFLICT, 'A variant with this SKU already exists');
    return new DomainError(ErrorCode.CONFLICT, 'This slug is already in use');
  }
}
