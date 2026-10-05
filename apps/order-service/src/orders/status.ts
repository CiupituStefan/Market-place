import { DomainError, ErrorCode, type OrderStatus } from '@market/types';

/**
 * The order state machine. Every status change in the service goes through
 * `assertTransition`, so an order can never skip a step or leave a final state.
 *
 *   PENDING ──▶ PENDING_PAYMENT ──▶ PAID ──▶ PROCESSING ──▶ SHIPPED ──▶ DELIVERED
 *      │               │             │            │                         │
 *      ▼               ▼             └────────────┴──────────▶ REFUNDED ◀───┘
 *    FAILED        CANCELLED
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['PENDING_PAYMENT', 'FAILED'],
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'REFUNDED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
  FAILED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError(
      ErrorCode.INVALID_ORDER_STATE,
      `An order that is ${label(from)} cannot become ${label(to)}`,
    );
  }
}

/** Internal checkout states are never shown to customers. */
export function isCustomerVisible(status: OrderStatus): boolean {
  return status !== 'PENDING' && status !== 'FAILED';
}

export function label(status: OrderStatus): string {
  return status.toLowerCase().replace('_', ' ');
}
