import { AdminPage } from '@/components/admin/admin-page';
import { DashboardView } from '@/components/admin/dashboard-view';

export default function AdminDashboardPage() {
  return (
    <AdminPage title="Dashboard" description="Store performance and what needs attention today.">
      <DashboardView />
    </AdminPage>
  );
}
