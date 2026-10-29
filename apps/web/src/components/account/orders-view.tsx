'use client';

import { CloudOffIcon, PackageIcon } from 'lucide-react';
import Link from '@/components/i18n/link';
import { useI18n } from '@/components/i18n/provider';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { OrderDetail } from '@/components/orders/order-detail';
import { OrderStatusBadge } from '@/components/orders/order-status';
import { ProductArt } from '@/components/product/product-art';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { userMessage } from '@/lib/api/errors';
import { useMyOrders } from '@/lib/api/orders';
import { RequireSession } from './require-session';

/** Order history of the signed-in user (order-service scopes it to the token's user). */
export function OrdersView() {
  return <RequireSession>{() => <OrderList />}</RequireSession>;
}

function OrderList() {
  const { t, money, date } = useI18n();
  const copy = t.account.orders;
  const [page, setPage] = useState(1);
  const orders = useMyOrders(page);

  if (orders.isPending) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label={copy.loading}>
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }
  if (orders.isError) {
    return (
      <EmptyState
        icon={CloudOffIcon}
        title={copy.loadFailed}
        description={userMessage(orders.error, t)}
        action={
          <Button variant="outline" onClick={() => void orders.refetch()}>
            {t.common.tryAgain}
          </Button>
        }
      />
    );
  }
  if (orders.data.items.length === 0) {
    return (
      <EmptyState
        icon={PackageIcon}
        title={copy.emptyTitle}
        description={copy.emptyBody}
        action={
          <Button asChild>
            <Link href="/shop">{copy.startShopping}</Link>
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
                  {date(order.createdAt)} · {copy.items(order.itemCount)}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
              <span className="font-medium tabular-nums">{money(order.total)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {orders.data.totalPages > 1 && (
        <nav aria-label={t.listing.pagination} className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => {
              setPage((p) => p - 1);
            }}
          >
            {copy.previous}
          </Button>
          <span className="text-sm text-muted-foreground">
            {copy.pageOf(page, orders.data.totalPages)}
          </span>
          <Button
            variant="outline"
            disabled={page >= orders.data.totalPages}
            onClick={() => {
              setPage((p) => p + 1);
            }}
          >
            {copy.next}
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
