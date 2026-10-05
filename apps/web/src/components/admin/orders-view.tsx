'use client';

import { ORDER_STATUSES, type OrderStatus } from '@market/types';
import { useCallback, useState } from 'react';
import { OrderStatusBadge, orderStatusLabel } from '@/components/orders/order-status';
import { useAdminOrders } from '@/lib/api/admin';
import { formatDateTime, formatMoney } from '@/lib/format';
import { DataTable, Pagination, SearchBox, SelectField, Toolbar } from './admin-page';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...ORDER_STATUSES.map((s) => ({ value: s, label: orderStatusLabel(s) })),
];

export function OrdersView() {
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const orders = useAdminOrders({ status: status || undefined, q, page });
  const onSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);

  return (
    <>
      <Toolbar>
        <SearchBox label="Search orders" placeholder="Order number or email" onSearch={onSearch} />
        <SelectField
          label="Status"
          hideLabel
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OrderStatus | '');
            setPage(1);
          }}
        />
      </Toolbar>
      <DataTable
        columns={[
          { header: 'Order', cell: (o) => <span className="font-medium">{o.number}</span> },
          {
            header: 'Customer',
            cell: (o) => <span className="text-muted-foreground">{o.email}</span>,
          },
          { header: 'Status', cell: (o) => <OrderStatusBadge status={o.status} /> },
          { header: 'Items', className: 'text-right tabular-nums', cell: (o) => o.itemCount },
          {
            header: 'Total',
            className: 'text-right tabular-nums',
            cell: (o) => formatMoney(o.total),
          },
          { header: 'Placed', cell: (o) => formatDateTime(o.createdAt) },
        ]}
        rows={orders.data?.items}
        rowKey={(o) => o.id}
        href={(o) => `/admin/orders/${o.id}`}
        loading={orders.isPending}
        error={orders.error}
        empty={q || status ? 'No orders match these filters.' : 'No orders yet.'}
      />
      {orders.data && (
        <Pagination
          page={page}
          pageSize={orders.data.pageSize}
          total={orders.data.total}
          onPage={setPage}
        />
      )}
    </>
  );
}
