'use client';

import { CloudOffIcon, PackageIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { OrderDetail } from '@/components/orders/order-detail';
import { OrderStatusBadge } from '@/components/orders/order-status';
import { ProductArt } from '@/components/product/product-art';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { userMessage } from '@/lib/api/errors';
import { useMyOrders } from '@/lib/api/orders';
import { formatDate, formatMoney, pluralize } from '@/lib/format';
import { RequireSession } from './require-session';

/** Order history of the signed-in user (order-service scopes it to the token's user). */
export function OrdersView() {
  return <RequireSession>{() => <OrderList />}</RequireSession>;
}

function OrderList() {
  const [page, setPage] = useState(1);
  const orders = useMyOrders(page);

  if (orders.isPending) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading orders">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }
  if (orders.isError) {
    return (
      <EmptyState
        icon={CloudOffIcon}
        title="We couldn’t load your orders"
        description={userMessage(orders.error)}
        action={
          <Button variant="outline" onClick={() => void orders.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }
  if (orders.data.items.length === 0) {
    return (
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
    );
  }
  return (
    <div className="grid gap-6">
      <ul className="grid gap-4">
        {orders.data.items.map((order) => (
          <li key={order.id}>
            <Link
              href={`/account/orders/${order.id}`}
              prefetch={false}
              className="flex flex-wrap items-center gap-4 rounded-2xl border p-4 transition-colors hover:bg-accent"
            >
              <div className="flex -space-x-4">
                {order.previews.map((preview, index) => (
                  <div
                    key={index}
                    className="flex size-14 items-center justify-center rounded-xl border-2 border-background bg-stage p-1.5"
                  >
                    <ProductArt preview={preview} title="" className="w-full" />
                  </div>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm">{order.number}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(order.createdAt)} · {pluralize(order.itemCount, 'item')}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
              <span className="font-medium tabular-nums">{formatMoney(order.total)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {orders.data.totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => {
              setPage((p) => p - 1);
            }}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {orders.data.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= orders.data.totalPages}
            onClick={() => {
              setPage((p) => p + 1);
            }}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}

export function OrderDetailView({ orderId }: { orderId: string }) {
  return (
    <RequireSession>
      {() => <OrderDetail orderId={orderId} backHref="/account/orders" />}
    </RequireSession>
  );
}
