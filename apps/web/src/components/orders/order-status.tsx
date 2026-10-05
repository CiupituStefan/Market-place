import type { OrderStatus } from '@market/types';
import { Badge } from '@/components/ui/badge';

const LABELS: Record<OrderStatus, string> = {
  PENDING: 'Processing',
  PENDING_PAYMENT: 'Awaiting payment',
  PAID: 'Paid',
  PROCESSING: 'Preparing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  FAILED: 'Not placed',
};

export function orderStatusLabel(status: OrderStatus): string {
  return LABELS[status];
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const variant =
    status === 'CANCELLED' || status === 'FAILED'
      ? 'destructive'
      : status === 'PENDING_PAYMENT'
        ? 'soft'
        : status === 'DELIVERED' || status === 'SHIPPED'
          ? 'brand'
          : 'outline';
  return <Badge variant={variant}>{LABELS[status]}</Badge>;
}
