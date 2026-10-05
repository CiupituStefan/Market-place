'use client';

import { useAdminOrders, useDailySales, useSalesSummary } from '@/lib/api/admin';
import { formatDateTime } from '@/lib/format';
import { OrderStatusBadge } from '@/components/orders/order-status';
import { formatMoney } from '@/lib/format';
import { change, DataTable, Panel, StatCard } from './admin-page';
import { InventoryAlerts } from './analytics-view';
import { presetRange } from './date-range';
import { compactMoney, count, money } from './format';
import { ColumnChart } from './sales-chart';

export function DashboardView() {
  const today = useSalesSummary(presetRange('today'));
  const month = useSalesSummary(presetRange('30d'));
  const daily = useDailySales(presetRange('30d'));
  const toShip = useAdminOrders({ status: 'PAID', page: 1, pageSize: 8 });
  const t = today.data;
  const m = month.data;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Net sales today"
          value={t ? money(t.netSales, t.currency) : '—'}
          trend={t ? change(t.netSales, t.previous.netSales) : null}
          hint="vs yesterday"
        />
        <StatCard
          label="Orders today"
          value={t ? count(t.paidOrders) : '—'}
          hint={t ? `${count(t.awaitingPayment)} awaiting payment` : undefined}
        />
        <StatCard
          label="Net sales, 30 days"
          value={m ? money(m.netSales, m.currency) : '—'}
          trend={m ? change(m.netSales, m.previous.netSales) : null}
          hint="vs previous 30 days"
        />
        <StatCard
          label="Average order value"
          value={m ? money(m.averageOrderValue, m.currency) : '—'}
          hint="Last 30 days"
        />
      </div>

      <Panel>
        <ColumnChart
          title="Net sales per day, last 30 days"
          points={
            daily.data?.days.map((d) => ({ date: d.date, value: d.grossSales - d.refunds })) ?? []
          }
          format={(v) => money(v)}
          axisFormat={(v) => compactMoney(v)}
          stale={daily.isPlaceholderData}
        />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Panel title="Paid, waiting to be prepared">
          <DataTable
            columns={[
              { header: 'Order', cell: (o) => <span className="font-medium">{o.number}</span> },
              {
                header: 'Customer',
                cell: (o) => <span className="text-muted-foreground">{o.email}</span>,
              },
              { header: 'Status', cell: (o) => <OrderStatusBadge status={o.status} /> },
              {
                header: 'Total',
                className: 'text-right tabular-nums',
                cell: (o) => formatMoney(o.total),
              },
              { header: 'Placed', cell: (o) => formatDateTime(o.createdAt) },
            ]}
            rows={toShip.data?.items}
            rowKey={(o) => o.id}
            href={(o) => `/admin/orders/${o.id}`}
            loading={toShip.isPending}
            error={toShip.error}
            empty="Nothing to prepare. Nice."
          />
        </Panel>
        <InventoryAlerts limit={6} />
      </div>
    </div>
  );
}
