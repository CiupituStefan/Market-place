import { AdminPage } from '@/components/admin/admin-page';
import { CustomersView } from '@/components/admin/customers-view';

export const metadata = { title: 'Customers' };

export default function AdminUsersPage() {
  return (
    <AdminPage title="Customers" description="Accounts with their orders, reviews and access.">
      <CustomersView />
    </AdminPage>
  );
}
