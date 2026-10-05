import { createServiceClient } from '@market/nest-common';
import { ProductStatusSchema } from '@market/types';
import { z } from 'zod';

const ProductLookupSchema = z.object({
  productId: z.uuid(),
  slug: z.string(),
  name: z.string(),
  status: ProductStatusSchema,
});
export type ProductLookup = z.infer<typeof ProductLookupSchema>;

/** product-service: does a product exist, and which product does a variant belong to. */
export interface CatalogGateway {
  products(productIds: string[]): Promise<ProductLookup[]>;
  productIdsOfVariants(variantIds: string[]): Promise<Map<string, string>>;
}

export const CATALOG = Symbol('CATALOG');

export class HttpCatalogGateway implements CatalogGateway {
  private readonly call;

  constructor(baseUrl: string) {
    this.call = createServiceClient({ baseUrl, service: 'product-service' });
  }

  products(productIds: string[]): Promise<ProductLookup[]> {
    if (productIds.length === 0) return Promise.resolve([]);
    return this.call('/internal/products/lookup', {
      method: 'POST',
      body: { productIds },
      schema: z.array(ProductLookupSchema),
    });
  }

  async productIdsOfVariants(variantIds: string[]): Promise<Map<string, string>> {
    if (variantIds.length === 0) return new Map();
    const rows = await this.call('/internal/variants/lookup', {
      method: 'POST',
      body: { variantIds },
      schema: z.array(z.object({ variantId: z.uuid(), productId: z.uuid() })),
    });
    return new Map(rows.map((row) => [row.variantId, row.productId]));
  }
}
