'use client';

import { AlertTriangleIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useBestSellers, useDailySales, useSalesSummary, useStock } from '@/lib/api/admin';
import { userMessage } from '@/lib/api/errors';
import { change, DataTable, Panel, StatCard, Toolbar } from './admin-page';
import { presetRange, RangePicker, type RangePreset } from './date-range';
import { compactMoney, count, money } from './format';
import { ColumnChart, RankedBars } from './sales-chart';

const METRICS = [
  { key: 'net', label: 'Net sales' },
  { key: 'gross', label: 'Gross sales' },
  { key: 'orders', label: 'Paid orders' },
] as const;
type Metric = (typeof METRICS)[number]['key'];

export function AnalyticsView() {
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [metric, setMetric] = useState<Metric>('net');
  const range = presetRange(preset);
  const summary = useSalesSummary(range);
  const daily = useDailySales(range);
  const best = useBestSellers(range, 10);
  const s = summary.data;

  const points =
    daily.data?.days.map((d) => ({
      date: d.date,
      value:
        metric === 'orders'
          ? d.paidOrders
          : metric === 'gross'
            ? d.grossSales
            : d.grossSales - d.refunds,
    })) ?? [];
  const isMoney = metric !== 'orders';

  return (
    <div className="grid gap-6">
      {/* Filters: one row, above everything they scope. */}
      <Toolbar>
        <RangePicker value={preset} onChange={setPreset} />
      </Toolbar>

      {summary.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {userMessage(summary.error)}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Net sales"
            value={s ? money(s.netSales, s.currency) : '—'}
            trend={s ? change(s.netSales, s.previous.netSales) : null}
            hint={s ? `vs previous ${String(daysIn(range))} days` : undefined}
          />
          <StatCard
            label="Paid orders"
            value={s ? count(s.paidOrders) : '—'}
            trend={s ? change(s.paidOrders, s.previous.paidOrders) : null}
            hint={s ? `${count(s.cancelledOrders)} cancelled` : undefined}
          />
          <StatCard
            label="Average order value"
            value={s ? money(s.averageOrderValue, s.currency) : '—'}
            trend={s ? change(s.averageOrderValue, s.previous.averageOrderValue) : null}
            hint="Gross / paid orders"
          />
          <StatCard
            label="Refunds"
            value={s ? money(s.refunds, s.currency) : '—'}
            hint={
              s
                ? `Gross ${money(s.grossSales, s.currency)} · discounts ${money(s.discounts, s.currency)}`
                : undefined
            }
          />
        </div>
      )}

      <Panel
        actions={
          <div role="radiogroup" aria-label="Measure" className="flex gap-1 text-sm">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={metric === m.key}
                onClick={() => {
                  setMetric(m.key);
                }}
                className={
                  metric === m.key
                    ? 'rounded-md bg-secondary px-2.5 py-1 font-semibold'
                    : 'rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground'
                }
              >
                {m.label}
              </button>
            ))}
          </div>
        }
      >
        {daily.isError ? (
          <p className="text-sm text-destructive">{userMessage(daily.error)}</p>
        ) : (
          <ColumnChart
            title={`${METRICS.find((m) => m.key === metric)?.label ?? ''} per day`}
            points={points}
            format={isMoney ? (v) => money(v) : (v) => count(v)}
            axisFormat={isMoney ? (v) => compactMoney(v) : (v) => count(v)}
            stale={daily.isPlaceholderData}
          />
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Days in store time ({s?.timeZone ?? 'Europe/Bucharest'}). Net = paid order totals minus
          refunds settled that day; VAT and shipping included.
        </p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Best sellers">
          {best.isError ? (
            <p className="text-sm text-destructive">{userMessage(best.error)}</p>
          ) : best.data?.items.length ? (
            <RankedBars
              rows={best.data.items.map((item) => ({
                key: item.sku,
                label: item.name,
                detail: `${item.sku} · ${money(item.revenue, best.data.currency)}`,
                value: item.units,
                display: `${count(item.units)} sold`,
              }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No sales in this period.</p>
          )}
        </Panel>
        <InventoryAlerts />
      </div>
    </div>
  );
}

function daysIn(range: { from: string; to: string }) {
  return Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86_400_000) + 1;
}

export function InventoryAlerts({ limit = 8 }: { limit?: number }) {
  const stock = useStock({ lowStock: true, page: 1 });
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <AlertTriangleIcon className="size-4 text-brand" aria-hidden="true" /> Inventory alerts
        </span>
      }
      actions={
        <Link
          href="/admin/inventory?lowStock=1"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          View all
        </Link>
      }
    >
      <DataTable
        columns={[
          { header: 'SKU', cell: (row) => <span className="font-mono text-xs">{row.sku}</span> },
          {
            header: 'Available',
            className: 'text-right tabular-nums',
            cell: (row) => count(row.available),
          },
          {
            header: 'Status',
            cell: (row) =>
              row.status === 'OUT_OF_STOCK' ? (
                <span className="text-destructive">Out of stock</span>
              ) : (
                <span>Low (≤ {row.lowStockThreshold})</span>
              ),
          },
        ]}
        rows={stock.data?.items.slice(0, limit)}
        rowKey={(row) => row.variantId}
        loading={stock.isPending}
        error={stock.error}
        empty="Every variant is above its reorder point."
      />
    </Panel>
  );
}
