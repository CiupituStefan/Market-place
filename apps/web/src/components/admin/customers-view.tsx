'use client';

import { ROLES, type Role } from '@market/types';
import { useCallback, useState } from 'react';
import { OrderStatusBadge } from '@/components/orders/order-status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAdminOrders,
  useAdminUser,
  useAdminUsers,
  useCustomerStats,
  useUpdateRoles,
} from '@/lib/api/admin';
import { useSession } from '@/lib/api/session';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import {
  AdminPage,
  DataTable,
  ErrorNote,
  Pagination,
  Panel,
  SearchBox,
  StatCard,
  Toolbar,
} from './admin-page';
import { count, money } from './format';
import { ReviewList } from './reviews-moderation';

function Roles({ roles }: { roles: Role[] }) {
  const shown = roles.filter((r) => r !== 'USER');
  if (shown.length === 0) return <span className="text-muted-foreground">Customer</span>;
  return (
    <span className="flex gap-1">
      {shown.map((r) => (
        <Badge key={r} variant={r === 'ADMIN' ? 'brand' : 'soft'}>
          {r.toLowerCase()}
        </Badge>
      ))}
    </span>
  );
}

export function CustomersView() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const users = useAdminUsers({ q, page });
  const onSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);
  return (
    <>
      <Toolbar>
        <SearchBox label="Search customers" placeholder="Name or email" onSearch={onSearch} />
      </Toolbar>
      <DataTable
        columns={[
          { header: 'Email', cell: (u) => <span className="font-medium">{u.email}</span> },
          { header: 'Name', cell: (u) => `${u.firstName} ${u.lastName}`.trim() || '—' },
          { header: 'Role', cell: (u) => <Roles roles={u.roles} /> },
          {
            header: 'Email confirmed',
            cell: (u) =>
              u.emailVerified ? 'Yes' : <span className="text-muted-foreground">No</span>,
          },
          { header: 'Joined', cell: (u) => formatDate(u.createdAt) },
        ]}
        rows={users.data?.items}
        rowKey={(u) => u.id}
        href={(u) => `/admin/users/${u.id}`}
        loading={users.isPending}
        error={users.error}
        empty={q ? 'No accounts match.' : 'No accounts yet.'}
      />
      {users.data && (
        <Pagination
          page={page}
          pageSize={users.data.pageSize}
          total={users.data.total}
          onPage={setPage}
        />
      )}
    </>
  );
}

export function CustomerDetail({ id }: { id: string }) {
  const user = useAdminUser(id);
  const stats = useCustomerStats(id);
  const [page, setPage] = useState(1);
  const orders = useAdminOrders({ userId: id, page, pageSize: 10 });
  const back = { href: '/admin/users', label: 'Customers' };

  if (user.isPending) {
    return (
      <AdminPage title="Customer" back={back}>
        <Skeleton className="h-96" />
      </AdminPage>
    );
  }
  if (user.isError) {
    return (
      <AdminPage title="Customer" back={back}>
        <ErrorNote error={user.error} />
      </AdminPage>
    );
  }
  const u = user.data;
  const s = stats.data;
  return (
    <AdminPage
      title={`${u.firstName} ${u.lastName}`.trim() || u.email}
      description={`${u.email} · joined ${formatDate(u.createdAt)}${u.emailVerified ? '' : ' · email not confirmed'}`}
      back={back}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Paid orders" value={s ? count(s.paidOrders) : '—'} />
          <StatCard
            label="Spent"
            value={s ? money(s.grossSpent - s.refunded, s.currency) : '—'}
            hint={
              s && s.refunded > 0
                ? `after ${money(s.refunded, s.currency)} refunded`
                : 'net of refunds'
            }
          />
          <StatCard
            label="Average order"
            value={s ? money(s.averageOrderValue, s.currency) : '—'}
          />
          <StatCard
            label="Last order"
            value={s?.lastOrderAt ? formatDate(s.lastOrderAt) : '—'}
            hint={s?.firstOrderAt ? `first ${formatDate(s.firstOrderAt)}` : undefined}
          />
        </div>
        <Panel title="Orders">
          <DataTable
            columns={[
              { header: 'Order', cell: (o) => <span className="font-medium">{o.number}</span> },
              { header: 'Status', cell: (o) => <OrderStatusBadge status={o.status} /> },
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
            empty="No orders yet."
          />
          {orders.data && (
            <Pagination
              page={page}
              pageSize={orders.data.pageSize}
              total={orders.data.total}
              onPage={setPage}
            />
          )}
        </Panel>
        <Panel title="Reviews">
          <ReviewList userId={id} />
        </Panel>
        <RolesPanel userId={u.id} roles={u.roles} />
      </div>
    </AdminPage>
  );
}

/** ADMIN only (the service enforces it); changing roles signs the user out everywhere. */
function RolesPanel({ userId, roles }: { userId: string; roles: Role[] }) {
  const session = useSession();
  const update = useUpdateRoles(userId);
  const [draft, setDraft] = useState<Role[]>(roles);
  const isAdmin = session.data?.roles.includes('ADMIN') ?? false;
  const dirty = [...draft].sort().join() !== [...roles].sort().join();
  return (
    <Panel title="Access">
      <div className="flex flex-wrap gap-6">
        {ROLES.map((role) => (
          <div key={role} className="flex items-center gap-2">
            <Checkbox
              id={`role-${role}`}
              checked={draft.includes(role)}
              disabled={!isAdmin || role === 'USER'}
              onCheckedChange={(checked) => {
                setDraft((current) =>
                  checked === true
                    ? [...new Set([...current, role])]
                    : current.filter((r) => r !== role),
                );
              }}
            />
            <Label htmlFor={`role-${role}`}>
              {role === 'USER' ? 'Customer' : role.charAt(0) + role.slice(1).toLowerCase()}
            </Label>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {isAdmin
          ? 'Saving signs this person out on every device so the change applies at once.'
          : 'Only admins can change access.'}
      </p>
      {isAdmin && (
        <Button
          className="mt-4"
          disabled={!dirty || update.isPending}
          onClick={() => {
            update.mutate(draft);
          }}
        >
          Save access
        </Button>
      )}
      <div className="mt-3">
        <ErrorNote error={update.error} />
      </div>
    </Panel>
  );
}
