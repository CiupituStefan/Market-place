import { ProductCreatedV1, ProductUpdatedV1, Topics } from '@market/events';
import { on, type ConsumerDefinition } from '@market/messaging';
import { SERVICE_NAME } from '../config.js';
import type { Database } from '../db/database.js';
import type { StockService } from '../stock/stock.service.js';

/**
 * What inventory-service reacts to on Kafka: every catalog variant gets a stock
 * record (at zero) as soon as it exists, so it can be received and sold.
 */
export function inventoryConsumers(stock: StockService): ConsumerDefinition<Database>[] {
  const sync = async (
    variants: readonly { variantId: string; sku: string }[],
    tx: Database,
  ): Promise<void> => {
    await stock.syncVariants(
      variants.map((v) => ({ variantId: v.variantId, sku: v.sku })),
      tx,
    );
  };
  return [
    {
      name: `${SERVICE_NAME}.catalog`,
      topics: [Topics.PRODUCT],
      handlers: [
        on(ProductCreatedV1, (event, tx: Database) => sync(event.payload.variants, tx)),
        on(ProductUpdatedV1, (event, tx: Database) => sync(event.payload.variants, tx)),
      ],
    },
  ];
}
