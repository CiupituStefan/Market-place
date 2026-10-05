import { createServiceClient } from '@market/nest-common';
import {
  AvailabilitySchema,
  ConfigurationQuoteSchema,
  ConfiguratorSchema,
  MoneySchema,
  ProductPreviewSchema,
  ProductStatusSchema,
  type ConfigurationQuote,
  type ConfigurationSelection,
  type Configurator,
} from '@market/types';
import { z } from 'zod';

export const VariantLookupSchema = z.object({
  variantId: z.uuid(),
  productId: z.uuid(),
  productSlug: z.string(),
  productName: z.string(),
  sku: z.string(),
  optionsLabel: z.string(),
  price: MoneySchema,
  compareAtPrice: MoneySchema.nullable(),
  availability: AvailabilitySchema,
  productStatus: ProductStatusSchema,
  preview: ProductPreviewSchema,
  imageUrl: z.string().nullable(),
});
export type VariantLookup = z.infer<typeof VariantLookupSchema>;

const StockSchema = z.object({ variantId: z.uuid(), available: z.int().nonnegative() });

/** Prices and product data: product-service is the source of truth. */
export interface CatalogGateway {
  lookupVariants(variantIds: string[]): Promise<VariantLookup[]>;
  quote(configurator: string, selection: ConfigurationSelection): Promise<ConfigurationQuote>;
  configurator(slug: string): Promise<Configurator>;
}

/** Sellable quantities: inventory-service is the source of truth. */
export interface InventoryGateway {
  available(variantIds: string[]): Promise<Map<string, number>>;
}

export const CATALOG = Symbol('CATALOG');
export const INVENTORY = Symbol('INVENTORY');

export class HttpCatalogGateway implements CatalogGateway {
  private readonly call;
  /** Configurator definitions change rarely; cache them briefly to label cart lines. */
  private readonly definitions = new Map<string, { value: Configurator; expiresAt: number }>();

  constructor(baseUrl: string) {
    this.call = createServiceClient({ baseUrl, service: 'product-service' });
  }

  lookupVariants(variantIds: string[]): Promise<VariantLookup[]> {
    if (variantIds.length === 0) return Promise.resolve([]);
    return this.call('/internal/variants/lookup', {
      method: 'POST',
      body: { variantIds },
      schema: z.array(VariantLookupSchema),
    });
  }

  quote(configurator: string, selection: ConfigurationSelection): Promise<ConfigurationQuote> {
    return this.call(`/configurator/${encodeURIComponent(configurator)}/quote`, {
      method: 'POST',
      body: { selection },
      schema: ConfigurationQuoteSchema,
    });
  }

  async configurator(slug: string): Promise<Configurator> {
    const cached = this.definitions.get(slug);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const value = await this.call(`/configurator/${encodeURIComponent(slug)}`, {
      schema: ConfiguratorSchema,
    });
    this.definitions.set(slug, { value, expiresAt: Date.now() + 60_000 });
    return value;
  }
}

export class HttpInventoryGateway implements InventoryGateway {
  private readonly call;

  constructor(baseUrl: string) {
    this.call = createServiceClient({ baseUrl, service: 'inventory-service', timeoutMs: 2_000 });
  }

  async available(variantIds: string[]): Promise<Map<string, number>> {
    if (variantIds.length === 0) return new Map();
    const rows = await this.call('/internal/availability', {
      method: 'POST',
      body: { variantIds },
      schema: z.array(StockSchema),
    });
    return new Map(rows.map((row) => [row.variantId, row.available]));
  }
}
