'use client';

import type { DiscountCode, DiscountType } from '@market/types';
import { PlusIcon } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
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
import { useDiscounts, useSaveDiscount, type DiscountInput } from '@/lib/api/admin';
import { formatDate, formatMoney } from '@/lib/format';
import {
  DataTable,
  ErrorNote,
  formText,
  parseAmount,
  SelectField,
  toAmountInput,
  Toolbar,
} from './admin-page';

function describe(code: DiscountCode): string {
  return code.type === 'PERCENTAGE'
    ? `${String(code.value / 100)}% off`
    : `${formatMoney({ amount: code.value, currency: 'EUR' })} off`;
}

function state(
  code: DiscountCode,
  now = Date.now(),
): { label: string; variant: 'outline' | 'soft' | 'destructive' } {
  if (!code.active) return { label: 'Inactive', variant: 'destructive' };
  if (code.expiresAt && Date.parse(code.expiresAt) < now)
    return { label: 'Expired', variant: 'destructive' };
  if (code.usageLimit !== null && code.usedCount >= code.usageLimit)
    return { label: 'Used up', variant: 'destructive' };
  if (code.startsAt && Date.parse(code.startsAt) > now)
    return { label: 'Scheduled', variant: 'soft' };
  return { label: 'Live', variant: 'outline' };
}

export function DiscountsView() {
  const discounts = useDiscounts();
  const [editing, setEditing] = useState<DiscountCode | 'new' | null>(null);
  return (
    <>
      <Toolbar>
        <Button
          onClick={() => {
            setEditing('new');
          }}
        >
          <PlusIcon /> New code
        </Button>
      </Toolbar>
      <DataTable
        columns={[
          {
            header: 'Code',
            cell: (c) => (
              <button
                type="button"
                className="font-mono font-medium hover:underline"
                onClick={() => {
                  setEditing(c);
                }}
              >
                {c.code}
              </button>
            ),
          },
          { header: 'Discount', cell: describe },
          { header: 'Minimum', cell: (c) => (c.minSubtotal ? formatMoney(c.minSubtotal) : '—') },
          {
            header: 'Used',
            className: 'tabular-nums',
            cell: (c) =>
              `${String(c.usedCount)}${c.usageLimit ? ` / ${String(c.usageLimit)}` : ''}`,
          },
          { header: 'Expires', cell: (c) => (c.expiresAt ? formatDate(c.expiresAt) : 'Never') },
          {
            header: 'State',
            cell: (c) => {
              const s = state(c);
              return <Badge variant={s.variant}>{s.label}</Badge>;
            },
          },
        ]}
        rows={discounts.data}
        rowKey={(c) => c.id}
        loading={discounts.isPending}
        error={discounts.error}
        empty="No discount codes yet."
      />
      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <SheetContent className="w-[min(94vw,28rem)] overflow-y-auto">
          {editing && (
            <DiscountForm
              key={editing === 'new' ? 'new' : editing.id}
              code={editing === 'new' ? null : editing}
              onDone={() => {
                setEditing(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** ISO → value for <input type="datetime-local"> in the browser's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** The stored value as the form shows it; empty when the type was switched. */
function initialValue(code: DiscountCode | null, type: DiscountType): string {
  if (code?.type !== type) return '';
  return type === 'PERCENTAGE' ? String(code.value / 100) : toAmountInput(code.value);
}

function DiscountForm({ code, onDone }: { code: DiscountCode | null; onDone: () => void }) {
  const save = useSaveDiscount();
  const [type, setType] = useState<DiscountType>(code?.type ?? 'PERCENTAGE');
  const [active, setActive] = useState(code?.active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (k: string) => formText(data, k);
    const next: Record<string, string> = {};
    const optionalInt = (k: string) => {
      if (!text(k)) return null;
      const n = Number(text(k));
      if (!Number.isInteger(n) || n <= 0) next[k] = 'A positive whole number, or empty';
      return n;
    };
    const date = (k: string) => (text(k) ? new Date(text(k)).toISOString() : null);

    // Percentages travel as basis points (10% = 1000), amounts in cents.
    const percent = Number(text('value').replace(',', '.'));
    const amount = parseAmount(text('value'));
    if (type === 'PERCENTAGE' && !(percent > 0 && percent <= 100)) next.value = 'Between 0 and 100';
    if (type === 'FIXED' && !amount) next.value = 'An amount like 15.00';
    const value = type === 'PERCENTAGE' ? Math.round(percent * 100) : (amount ?? 0);
    const minSubtotal = text('minSubtotal') ? parseAmount(text('minSubtotal')) : null;
    if (text('minSubtotal') && !minSubtotal) next.minSubtotal = 'An amount like 99.00, or empty';
    const input: DiscountInput = {
      type,
      value,
      minSubtotal,
      startsAt: date('startsAt'),
      expiresAt: date('expiresAt'),
      usageLimit: optionalInt('usageLimit'),
      perCustomerLimit: optionalInt('perCustomerLimit'),
      active,
    };
    if (input.startsAt && input.expiresAt && input.expiresAt <= input.startsAt) {
      next.expiresAt = 'Must be after the start';
    }
    if (!code && !/^[A-Za-z0-9_-]{3,32}$/.test(text('code')))
      next.code = '3–32 letters, digits, - or _';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    save.mutate(code ? { ...input, id: code.id } : { ...input, code: text('code').toUpperCase() }, {
      onSuccess: onDone,
    });
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{code ? code.code : 'New discount code'}</SheetTitle>
        <SheetDescription>
          {code
            ? `Used ${String(code.usedCount)} times. The code itself cannot be renamed.`
            : 'Customers enter it in the cart; the server applies it.'}
        </SheetDescription>
      </SheetHeader>
      <form onSubmit={submit} noValidate className="grid gap-4 px-5 pb-6">
        {!code && (
          <FormField
            label="Code"
            name="code"
            placeholder="SUMMER15"
            autoCapitalize="characters"
            error={errors.code}
          />
        )}
        <SelectField
          label="Type"
          value={type}
          onChange={(e) => {
            setType(e.target.value as DiscountType);
          }}
          options={[
            { value: 'PERCENTAGE', label: 'Percentage of the subtotal' },
            { value: 'FIXED', label: 'Fixed amount (€)' },
          ]}
        />
        <FormField
          key={type}
          label={type === 'PERCENTAGE' ? 'Percent off' : 'Amount off (€)'}
          name="value"
          inputMode="decimal"
          defaultValue={initialValue(code, type)}
          error={errors.value}
        />
        <FormField
          label="Minimum subtotal (€, optional)"
          name="minSubtotal"
          inputMode="decimal"
          defaultValue={toAmountInput(code?.minSubtotal?.amount)}
          error={errors.minSubtotal}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Starts (optional)"
            name="startsAt"
            type="datetime-local"
            defaultValue={toLocalInput(code?.startsAt ?? null)}
          />
          <FormField
            label="Expires (optional)"
            name="expiresAt"
            type="datetime-local"
            defaultValue={toLocalInput(code?.expiresAt ?? null)}
            error={errors.expiresAt}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Total uses (optional)"
            name="usageLimit"
            type="number"
            min={1}
            defaultValue={code?.usageLimit ?? ''}
            error={errors.usageLimit}
          />
          <FormField
            label="Uses per customer (optional)"
            name="perCustomerLimit"
            type="number"
            min={1}
            defaultValue={code?.perCustomerLimit ?? ''}
            error={errors.perCustomerLimit}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="discount-active"
            checked={active}
            onCheckedChange={(c) => {
              setActive(c === true);
            }}
          />
          <Label htmlFor="discount-active">Active</Label>
        </div>
        <ErrorNote error={save.error} />
        <Button type="submit" disabled={save.isPending}>
          {code ? 'Save changes' : 'Create code'}
        </Button>
      </form>
    </>
  );
}
