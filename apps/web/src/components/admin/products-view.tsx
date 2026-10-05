'use client';

import { PRODUCT_STATUSES, type ProductStatus } from '@market/types';
import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { useAdminProducts } from '@/lib/api/admin';
import { formatDate, formatMoney } from '@/lib/format';
import { DataTable, Pagination, SearchBox, SelectField, Toolbar } from './admin-page';

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return (
    <Badge
      variant={status === 'PUBLISHED' ? 'brand' : status === 'ARCHIVED' ? 'destructive' : 'soft'}
    >
      {status.toLowerCase()}
    </Badge>
  );
}

const AVAILABILITY: Record<string, string> = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
  PREORDER: 'Pre-order',
};

export const AVAILABILITY_OPTIONS = Object.entries(AVAILABILITY).map(([value, label]) => ({
  value,
  label,
}));

export function ProductsView() {
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const products = useAdminProducts({ status: status || undefined, q, page });
  const onSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);
  return (
    <>
      <Toolbar>
        <SearchBox label="Search products" placeholder="Name, slug or brand" onSearch={onSearch} />
        <SelectField
          label="Status"
          hideLabel
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ProductStatus | '');
            setPage(1);
          }}
          options={[
            { value: '', label: 'All statuses' },
            ...PRODUCT_STATUSES.map((s) => ({
              value: s,
              label: s.charAt(0) + s.slice(1).toLowerCase(),
            })),
          ]}
        />
      </Toolbar>
      <DataTable
        columns={[
          {
            header: 'Product',
            cell: (p) => (
              <span className="grid">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.slug}</span>
              </span>
            ),
          },
          { header: 'Status', cell: (p) => <ProductStatusBadge status={p.status} /> },
          { header: 'Variants', className: 'text-right tabular-nums', cell: (p) => p.variantCount },
          {
            header: 'Price from',
            className: 'text-right tabular-nums',
            cell: (p) => formatMoney(p.price),
          },
          { header: 'Stock', cell: (p) => AVAILABILITY[p.availability] ?? p.availability },
          { header: 'Created', cell: (p) => formatDate(p.createdAt) },
        ]}
        rows={products.data?.items}
        rowKey={(p) => p.id}
        href={(p) => `/admin/products/${p.id}`}
        loading={products.isPending}
        error={products.error}
        empty={q || status ? 'No products match.' : 'No products yet.'}
      />
      {products.data && (
        <Pagination
          page={page}
          pageSize={products.data.pageSize}
          total={products.data.total}
          onPage={setPage}
        />
      )}
    </>
  );
}
