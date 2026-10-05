'use client';

import { RESERVATION_STATUSES, type StockItem } from '@market/types';
import { useSearchParams } from 'next/navigation';
import { useCallback, useState, type SubmitEvent } from 'react';
import { FormField } from '@/components/auth/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useAdjustStock,
  useMovements,
  useReservations,
  useSetThreshold,
  useStock,
} from '@/lib/api/admin';
import { formatDateTime } from '@/lib/format';
import {
  DataTable,
  ErrorNote,
  formText,
  Pagination,
  SearchBox,
  SelectField,
  Toolbar,
} from './admin-page';
import { count } from './format';

export function InventoryView() {
  return (
    <Tabs defaultValue="stock">
      <TabsList className="mb-6">
        <TabsTrigger value="stock">Stock levels</TabsTrigger>
        <TabsTrigger value="reservations">Reservations</TabsTrigger>
      </TabsList>
      <TabsContent value="stock">
        <StockTab />
      </TabsContent>
      <TabsContent value="reservations">
        <ReservationsTab />
      </TabsContent>
    </Tabs>
  );
}

function StockStatus({ item }: { item: StockItem }) {
  if (item.status === 'OUT_OF_STOCK') return <Badge variant="destructive">Out of stock</Badge>;
  if (item.status === 'LOW_STOCK') return <Badge variant="soft">Low stock</Badge>;
  return <Badge variant="outline">In stock</Badge>;
}

function StockTab() {
  const initialLow = useSearchParams().get('lowStock') === '1';
  const [lowStock, setLowStock] = useState(initialLow);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StockItem | null>(null);
  const stock = useStock({ q, lowStock, page });
  const onSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);

  return (
    <>
      <Toolbar>
        <SearchBox label="Search SKU" placeholder="SKU" onSearch={onSearch} />
        <div className="flex h-10 items-center gap-2">
          <Checkbox
            id="low-stock"
            checked={lowStock}
            onCheckedChange={(checked) => {
              setLowStock(checked === true);
              setPage(1);
            }}
          />
          <Label htmlFor="low-stock">Only low and out of stock</Label>
        </div>
      </Toolbar>
      <DataTable
        columns={[
          {
            header: 'SKU',
            cell: (row) => (
              <button
                type="button"
                className="font-mono text-xs font-medium hover:underline"
                onClick={() => {
                  setSelected(row);
                }}
              >
                {row.sku}
              </button>
            ),
          },
          { header: 'On hand', className: 'text-right tabular-nums', cell: (r) => count(r.onHand) },
          {
            header: 'Reserved',
            className: 'text-right tabular-nums',
            cell: (r) => count(r.reserved),
          },
          {
            header: 'Available',
            className: 'text-right tabular-nums font-medium',
            cell: (r) => count(r.available),
          },
          {
            header: 'Reorder at',
            className: 'text-right tabular-nums',
            cell: (r) => r.lowStockThreshold,
          },
          { header: 'Status', cell: (r) => <StockStatus item={r} /> },
          { header: 'Updated', cell: (r) => formatDateTime(r.updatedAt) },
        ]}
        rows={stock.data?.items}
        rowKey={(r) => r.variantId}
        loading={stock.isPending}
        error={stock.error}
        empty={lowStock ? 'Nothing is running low.' : 'No stock records yet.'}
      />
      {stock.data && (
        <Pagination
          page={page}
          pageSize={stock.data.pageSize}
          total={stock.data.total}
          onPage={setPage}
        />
      )}
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent className="w-[min(94vw,32rem)] overflow-y-auto">
          {selected && (
            <VariantStock
              item={stock.data?.items.find((i) => i.variantId === selected.variantId) ?? selected}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function VariantStock({ item }: { item: StockItem }) {
  const adjust = useAdjustStock();
  const threshold = useSetThreshold();
  const movements = useMovements(item.variantId);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submitAdjustment(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const delta = Number(data.get('delta'));
    const reason = formText(data, 'reason');
    const type = data.get('type') === 'RECEIVED' ? 'RECEIVED' : 'ADJUSTMENT';
    const next: Record<string, string> = {};
    if (!Number.isInteger(delta) || delta === 0) next.delta = 'A whole number, not zero';
    else if (type === 'RECEIVED' && delta < 0) next.delta = 'Received goods are a positive number';
    if (reason.length < 3) next.reason = 'Say why (at least 3 characters)';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    adjust.mutate(
      { variantId: item.variantId, type, delta, reason },
      {
        onSuccess: () => {
          form.reset();
          void movements.refetch();
        },
      },
    );
  }

  function submitThreshold(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(new FormData(event.currentTarget).get('threshold'));
    if (!Number.isInteger(value) || value < 0) {
      setErrors({ threshold: 'Zero or a positive whole number' });
      return;
    }
    setErrors({});
    threshold.mutate({ variantId: item.variantId, lowStockThreshold: value });
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle className="font-mono">{item.sku}</SheetTitle>
        <SheetDescription>
          {count(item.onHand)} on hand · {count(item.reserved)} reserved · {count(item.available)}{' '}
          available
        </SheetDescription>
      </SheetHeader>
      <div className="grid gap-6 px-5 pb-6">
        <form onSubmit={submitAdjustment} noValidate className="grid gap-3">
          <h3 className="text-sm font-semibold">Record a stock change</h3>
          <SelectField
            label="Type"
            name="type"
            options={[
              { value: 'RECEIVED', label: 'Goods received (+)' },
              { value: 'ADJUSTMENT', label: 'Correction (count, damage, loss: ±)' },
            ]}
          />
          <FormField
            label="Quantity"
            name="delta"
            type="number"
            step={1}
            inputMode="numeric"
            error={errors.delta}
          />
          <FormField
            label="Reason"
            name="reason"
            placeholder="e.g. PO-1042 from supplier"
            error={errors.reason}
          />
          <Button type="submit" disabled={adjust.isPending}>
            Save change
          </Button>
          <ErrorNote error={adjust.error} />
          <p className="text-xs text-muted-foreground">
            Stock can never go below what is reserved for open orders.
          </p>
        </form>
        <form onSubmit={submitThreshold} noValidate className="grid gap-3 border-t pt-5">
          <h3 className="text-sm font-semibold">Low-stock alert</h3>
          <FormField
            key={item.lowStockThreshold}
            label="Alert when available stock is at or below"
            name="threshold"
            type="number"
            min={0}
            defaultValue={item.lowStockThreshold}
            error={errors.threshold}
          />
          <Button type="submit" variant="outline" disabled={threshold.isPending}>
            Update threshold
          </Button>
          <ErrorNote error={threshold.error} />
        </form>
        <div className="grid gap-2 border-t pt-5">
          <h3 className="text-sm font-semibold">Movements</h3>
          {movements.isError ? (
            <ErrorNote error={movements.error} />
          ) : (
            <ol className="grid gap-2 text-sm">
              {movements.data?.map((m) => (
                <li key={m.id} className="rounded-lg border p-3">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{m.type.replaceAll('_', ' ').toLowerCase()}</span>
                    <span className="tabular-nums">
                      {m.onHandDelta !== 0 &&
                        `${m.onHandDelta > 0 ? '+' : ''}${String(m.onHandDelta)} on hand`}
                      {m.onHandDelta !== 0 && m.reservedDelta !== 0 && ' · '}
                      {m.reservedDelta !== 0 &&
                        `${m.reservedDelta > 0 ? '+' : ''}${String(m.reservedDelta)} reserved`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(m.createdAt)} · {m.actor === 'system' ? 'system' : 'staff'}
                    {m.reason ? ` · ${m.reason}` : ''} · after: {m.onHandAfter} / {m.reservedAfter}
                  </p>
                </li>
              ))}
              {movements.data?.length === 0 && (
                <li className="text-muted-foreground">No movements yet.</li>
              )}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}

const RESERVATION_OPTIONS = [
  { value: 'ACTIVE', label: 'Active holds' },
  ...RESERVATION_STATUSES.filter((s) => s !== 'ACTIVE').map((s) => ({
    value: s,
    label: s.charAt(0) + s.slice(1).toLowerCase(),
  })),
];

function ReservationsTab() {
  const [status, setStatus] = useState<(typeof RESERVATION_STATUSES)[number]>('ACTIVE');
  const reservations = useReservations(status);
  return (
    <>
      <Toolbar>
        <SelectField
          label="Status"
          hideLabel
          options={RESERVATION_OPTIONS}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as (typeof RESERVATION_STATUSES)[number]);
          }}
        />
      </Toolbar>
      <DataTable
        columns={[
          {
            header: 'Order',
            cell: (r) => (
              <a href={`/admin/orders/${r.orderId}`} className="font-mono text-xs hover:underline">
                {r.orderId.slice(0, 8)}
              </a>
            ),
          },
          {
            header: 'Items',
            cell: (r) => r.lines.map((l) => `${String(l.quantity)} × ${l.sku}`).join(', '),
          },
          { header: 'Status', cell: (r) => r.status.toLowerCase() },
          {
            header: status === 'ACTIVE' ? 'Expires' : 'Hold until',
            cell: (r) => formatDateTime(r.expiresAt),
          },
        ]}
        rows={reservations.data}
        rowKey={(r) => r.id}
        loading={reservations.isPending}
        error={reservations.error}
        empty="No reservations with this status."
      />
    </>
  );
}
