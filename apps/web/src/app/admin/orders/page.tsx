import { AdminPage } from '@/components/admin/admin-page';
import { OrdersView } from '@/components/admin/orders-view';

export const metadata = { title: 'Orders' };

export default function AdminOrdersPage() {
  return (
    <AdminPage
      title="Orders"
      description="Review orders, update status, add tracking and issue refunds."
    >
      <OrdersView />
    </AdminPage>
  );
}
