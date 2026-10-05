'use client';

import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useState, type ComponentProps, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { userMessage } from '@/lib/api/errors';
import { cn } from '@/lib/utils';

export function AdminPage({
  title,
  description,
  actions,
  back,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-8">
      {back && (
        <Link
          href={back.href}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" /> {back.label}
        </Link>
      )}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border bg-card p-5 md:p-6', className)}>
      {(title ?? actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

/** Plain, accessible table; rows can link to a detail page. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  loading,
  error,
  href,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  empty: string;
  loading?: boolean;
  error?: unknown;
  href?: (row: T) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-secondary/50 text-xs text-muted-foreground uppercase">
          <tr>
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={cn(
                  'px-4 py-3 font-medium tracking-wide whitespace-nowrap',
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {error ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-destructive">
                {userMessage(error)}
              </td>
            </tr>
          ) : loading && !rows ? (
            Array.from({ length: 5 }, (_, i) => (
              <tr key={i} className="border-b last:border-0">
                <td colSpan={columns.length} className="px-4 py-3">
                  <Skeleton className="h-5" />
                </td>
              </tr>
            ))
          ) : !rows?.length ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-16 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={cn('border-b last:border-0', href && 'relative hover:bg-accent/60')}
              >
                {columns.map((column, i) => (
                  <td
                    key={column.header}
                    className={cn('px-4 py-3 align-middle whitespace-nowrap', column.className)}
                  >
                    {href && i === 0 ? (
                      // The first cell's link covers the row (keyboard: one tab stop per row).
                      <Link
                        href={href(row)}
                        className="after:absolute after:inset-0 hover:underline"
                      >
                        {column.cell(row)}
                      </Link>
                    ) : (
                      column.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
      <p className="text-muted-foreground">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => {
            onPage(page - 1);
          }}
        >
          <ChevronLeftIcon /> Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => {
            onPage(page + 1);
          }}
        >
          Next <ChevronRightIcon />
        </Button>
      </div>
    </nav>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end gap-3">{children}</div>;
}

/** Search box that reports its value after the user stops typing. */
export function SearchBox({
  label,
  placeholder,
  onSearch,
}: {
  label: string;
  placeholder: string;
  onSearch: (value: string) => void;
}) {
  const id = useId();
  const [value, setValue] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(value.trim());
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [value, onSearch]);
  return (
    <div className="relative min-w-56 flex-1 sm:max-w-xs">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id={id}
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        className="pl-9"
      />
    </div>
  );
}

const fieldClass =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50';

export function SelectField({
  label,
  options,
  hideLabel,
  className,
  ...props
}: ComponentProps<'select'> & {
  label: string;
  hideLabel?: boolean;
  options: readonly { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </Label>
      <select id={id} className={fieldClass} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  className,
  ...props
}: ComponentProps<'textarea'> & { label: string; hint?: string; error?: string | undefined }) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${id}-hint` : undefined}
        className={cn(
          'min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-invalid:border-destructive',
          className,
        )}
        {...props}
      />
      {(error ?? hint) && (
        <p
          id={`${id}-hint`}
          className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
      {userMessage(error)}
    </p>
  );
}

export function StatCard({
  label,
  value,
  hint,
  trend,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Relative change against the previous period, e.g. 0.12 for +12%. */
  trend?: number | null;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {trend !== undefined && trend !== null && Number.isFinite(trend) && (
          <span
            className={cn(
              'font-medium tabular-nums',
              trend > 0 ? 'text-success' : trend < 0 ? 'text-destructive' : '',
            )}
          >
            {trend > 0 ? '▲' : trend < 0 ? '▼' : '■'} {Math.abs(Math.round(trend * 100))}%
          </span>
        )}
        {hint}
      </p>
    </div>
  );
}

/** Relative change, or null when there is nothing to compare with. */
export function change(current: number, previous: number): number | null {
  return previous === 0 ? null : (current - previous) / previous;
}

/** "129.99" → 12999. Returns null for anything that is not a non-negative amount. */
export function parseAmount(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** A text field from FormData (files and missing fields become ''). */
export function formText(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export const toAmountInput = (minor: number | null | undefined) =>
  minor === null || minor === undefined ? '' : (minor / 100).toFixed(2);
