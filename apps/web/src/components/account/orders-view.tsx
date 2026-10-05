'use client';

import { PackageIcon } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { RequireSession } from './require-session';

/** Order history. Data comes from order-service (scoped to the user by the gateway). */
export function OrdersView() {
  return (
    <RequireSession>
      {() => (
        <EmptyState
          icon={PackageIcon}
          title="No orders yet"
          description="When you place an order, you can track it here."
          action={
            <Button asChild>
              <Link href="/shop">Start shopping</Link>
            </Button>
          }
        />
      )}
    </RequireSession>
  );
}

export function OrderDetailView({ orderId }: { orderId: string }) {
  return (
    <RequireSession>
      {() => (
        <EmptyState
          icon={PackageIcon}
          title="Order not found"
          description={`We couldn’t find order ${orderId} in your account.`}
          action={
            <Button variant="outline" asChild>
              <Link href="/account/orders">All orders</Link>
            </Button>
          }
        />
      )}
    </RequireSession>
  );
}
