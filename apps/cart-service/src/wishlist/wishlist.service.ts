import { DomainError, ErrorCode, type WishlistItem } from '@market/types';
import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { CATALOG, type CatalogGateway } from '../clients/clients.js';
import { DATABASE, type Database } from '../db/database.js';
import { wishlistItems } from '../db/schema.js';

export const MAX_WISHLIST_ITEMS = 100;

/** Saved-for-later variants of signed-in users. Product data is read live from the catalog. */
@Injectable()
export class WishlistService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CATALOG) private readonly catalog: CatalogGateway,
  ) {}

  async list(userId: string): Promise<WishlistItem[]> {
    const rows = await this.db
      .select()
      .from(wishlistItems)
      .where(eq(wishlistItems.userId, userId))
      .orderBy(desc(wishlistItems.createdAt));
    const lookups = await this.catalog.lookupVariants(rows.map((row) => row.variantId));
    const byId = new Map(lookups.map((lookup) => [lookup.variantId, lookup]));
    // Products removed from the catalog simply drop out of the list.
    return rows.flatMap((row) => {
      const lookup = byId.get(row.variantId);
      if (!lookup || lookup.productStatus === 'DRAFT') return [];
      return [
        {
          variantId: row.variantId,
          productSlug: lookup.productSlug,
          name: lookup.productName,
          optionsLabel: lookup.optionsLabel,
          price: lookup.price,
          compareAtPrice: lookup.compareAtPrice,
          preview: lookup.preview,
          imageUrl: lookup.imageUrl,
          available: lookup.productStatus === 'PUBLISHED' && lookup.availability !== 'OUT_OF_STOCK',
          addedAt: row.createdAt.toISOString(),
        },
      ];
    });
  }

  async add(userId: string, variantId: string): Promise<WishlistItem[]> {
    const [variant] = await this.catalog.lookupVariants([variantId]);
    if (variant?.productStatus !== 'PUBLISHED') {
      throw new DomainError(ErrorCode.VARIANT_NOT_FOUND, 'This product is not available');
    }
    const [{ total } = { total: 0 }] = await this.db
      .select({ total: count() })
      .from(wishlistItems)
      .where(eq(wishlistItems.userId, userId));
    if (total >= MAX_WISHLIST_ITEMS) {
      throw new DomainError(ErrorCode.CONFLICT, 'Your wishlist is full');
    }
    // Saving twice is not an error.
    await this.db.insert(wishlistItems).values({ userId, variantId }).onConflictDoNothing();
    return this.list(userId);
  }

  async remove(userId: string, variantId: string): Promise<WishlistItem[]> {
    await this.db
      .delete(wishlistItems)
      .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.variantId, variantId)));
    return this.list(userId);
  }
}
