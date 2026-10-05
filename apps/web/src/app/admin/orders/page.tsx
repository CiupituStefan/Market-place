import { AdminPage, AdminTable } from '@/components/admin/admin-page';

export const metadata = { title: 'Orders' };

export default function AdminOrdersPage() {
  return (
    <AdminPage
      title="Orders"
      description="Review orders, update status, add tracking and issue refunds."
    >
      <AdminTable
        columns={['Order', 'Customer', 'Status', 'Total', 'Payment', 'Placed']}
        empty="No orders yet."
      />
    </AdminPage>
  );
}
