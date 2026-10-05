import { InventoryStockChangedV1, ProductRatingChangedV1, Topics } from '@market/events';
import { on, type ConsumerDefinition } from '@market/messaging';
import type { CatalogWriterService } from '../catalog/catalog-writer.service.js';
import { SERVICE_NAME } from '../config.js';
import type { Database } from '../db/database.js';

/** What product-service reacts to on Kafka. */
export function productConsumers(writer: CatalogWriterService): ConsumerDefinition<Database>[] {
  return [
    {
      name: `${SERVICE_NAME}.inventory`,
      topics: [Topics.INVENTORY],
      handlers: [
        // Database-only: runs inside the inbox transaction, so it applies exactly once.
        on(InventoryStockChangedV1, async (event, tx: Database) => {
          await writer.applyStockLevel(tx, event.payload.variantId, event.payload.availability);
        }),
      ],
    },
    {
      name: `${SERVICE_NAME}.reviews`,
      topics: [Topics.REVIEW],
      handlers: [
        on(ProductRatingChangedV1, async (event, tx: Database) => {
          await writer.applyRating(
            tx,
            event.payload.productId,
            event.payload.average,
            event.payload.count,
          );
        }),
      ],
    },
  ];
}
