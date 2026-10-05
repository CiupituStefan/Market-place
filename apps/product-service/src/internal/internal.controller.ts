import { ZodValidationPipe } from '@market/nest-common';
import type { Availability, Money, ProductStatus } from '@market/types';
import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { money } from '../catalog/mappers.js';
import { DATABASE, type Database } from '../db/database.js';
import { products, productVariants } from '../db/schema.js';

const LookupSchema = z.object({ variantIds: z.array(z.uuid()).min(1).max(100) }).strict();

export interface VariantLookup {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  sku: string;
  options: Record<string, string>;
  optionsLabel: string;
  price: Money;
  compareAtPrice: Money | null;
  availability: Availability;
  productStatus: ProductStatus;
}

/**
 * Service-to-service API (cart and order services re-price lines from here, so
 * the client never decides a price). Paths under `internal` are not routable
 * through the gateway; NetworkPolicies restrict callers in Kubernetes.
 */
@ApiExcludeController()
@Controller('internal')
export class InternalController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Post('variants/lookup')
  @HttpCode(200)
  async lookup(
    @Body(new ZodValidationPipe(LookupSchema)) body: { variantIds: string[] },
  ): Promise<VariantLookup[]> {
    const rows = await this.db
      .select({ variant: productVariants, product: products })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(inArray(productVariants.id, body.variantIds));
    return rows.map(({ variant, product }) => ({
      variantId: variant.id,
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      sku: variant.sku,
      options: variant.options,
      optionsLabel: product.options
        .map((option) => option.values.find((v) => v.value === variant.options[option.key])?.label)
        .filter(Boolean)
        .join(' / '),
      price: money(variant.priceAmount, variant.currency),
      compareAtPrice:
        variant.compareAtAmount === null ? null : money(variant.compareAtAmount, variant.currency),
      availability: variant.availability,
      productStatus: product.status,
    }));
  }
}
