import { z } from 'zod';
import { defineEvent } from '../define.js';
import { Topics } from '../topics.js';

const ReservationLine = z.object({
  variantId: z.uuid(),
  sku: z.string().min(1),
  quantity: z.int().positive(),
});

const ReservationRef = z.object({
  reservationId: z.uuid(),
  orderId: z.uuid(),
  lines: z.array(ReservationLine).min(1),
});

export const InventoryReservedV1 = defineEvent({
  type: 'InventoryReserved',
  version: 1,
  topic: Topics.INVENTORY,
  payload: ReservationRef.extend({ expiresAt: z.iso.datetime() }),
});

export const InventoryReservationExpiredV1 = defineEvent({
  type: 'InventoryReservationExpired',
  version: 1,
  topic: Topics.INVENTORY,
  payload: ReservationRef,
});

export const InventoryReleasedV1 = defineEvent({
  type: 'InventoryReleased',
  version: 1,
  topic: Topics.INVENTORY,
  payload: ReservationRef.extend({
    reason: z.enum(['PAYMENT_FAILED', 'ORDER_CANCELLED', 'EXPIRED', 'MANUAL']),
  }),
});

export const InventoryDecrementedV1 = defineEvent({
  type: 'InventoryDecremented',
  version: 1,
  topic: Topics.INVENTORY,
  payload: ReservationRef.extend({
    /** Remaining on-hand stock per variant after the decrement, for low-stock alerts. */
    remaining: z.array(z.object({ variantId: z.uuid(), onHand: z.int().nonnegative() })),
  }),
});
