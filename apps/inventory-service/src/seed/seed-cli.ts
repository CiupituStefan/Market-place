import { connectPostgres } from '@market/db';
import { createLogger } from '@market/logger';
import { ProductListingSchema, ProductSchema } from '@market/types';
import { eq } from 'drizzle-orm';
import { loadConfig, SERVICE_NAME } from '../config.js';
import { schema } from '../db/database.js';
import { inventoryItems } from '../db/schema.js';
import { StockService } from '../stock/stock.service.js';

/**
 * Demo stock for local development: creates stock records for every published
 * variant (read from product-service) and receives a quantity that matches the
 * demo availability. Idempotent: variants that already have stock are skipped.
 */
const logger = createLogger({ service: `${SERVICE_NAME}-seed` });
const config = loadConfig();
if (config.NODE_ENV === 'production') {
  logger.fatal('refusing to load demo data into a production database');
  process.exit(1);
}

const QUANTITY = { IN_STOCK: 25, LOW_STOCK: 3, PREORDER: 0, OUT_OF_STOCK: 0 } as const;

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(new URL(path, config.PRODUCT_SERVICE_URL));
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

const postgres = connectPostgres({
  url: config.DATABASE_URL,
  schema,
  applicationName: `${SERVICE_NAME}-seed`,
  maxConnections: 2,
});
try {
  const stock = new StockService(postgres.db, config);
  const listing = ProductListingSchema.parse(await getJson('/api/v1/products?pageSize=100'));
  let received = 0;
  for (const summary of listing.items) {
    const product = ProductSchema.parse(await getJson(`/api/v1/products/${summary.slug}`));
    await stock.syncVariants(product.variants.map((v) => ({ variantId: v.id, sku: v.sku })));
    for (const variant of product.variants) {
      const [item] = await postgres.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.variantId, variant.id));
      const quantity = QUANTITY[variant.availability];
      if (!item || item.onHand > 0 || quantity === 0) continue;
      await stock.adjust(
        variant.id,
        { type: 'RECEIVED', delta: quantity, reason: 'demo seed' },
        'seed',
      );
      received += 1;
    }
  }
  logger.info({ products: listing.items.length, variantsReceived: received }, 'demo stock loaded');
} catch (error) {
  logger.fatal({ err: error }, 'seeding failed');
  process.exitCode = 1;
} finally {
  await postgres.close();
}
