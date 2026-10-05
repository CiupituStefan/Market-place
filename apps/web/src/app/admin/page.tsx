import { AdminPage, AdminTable, StatCard } from '@/components/admin/admin-page';

export default function AdminDashboardPage() {
  return (
    <AdminPage title="Dashboard" description="Store performance and items that need attention.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue today" value="—" hint="Paid orders only" />
        <StatCard label="Orders today" value="—" hint="Excludes cancelled" />
        <StatCard label="Avg. order value" value="—" hint="Last 30 days" />
        <StatCard label="Low-stock variants" value="—" hint="Below reorder point" />
      </div>
      <h2 className="mt-10 mb-4 font-semibold">Orders awaiting fulfilment</h2>
      <AdminTable
        columns={['Order', 'Customer', 'Items', 'Total', 'Paid at']}
        empty="No orders waiting."
      />
    </AdminPage>
  );
}
