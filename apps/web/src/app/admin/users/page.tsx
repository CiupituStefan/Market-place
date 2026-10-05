import { AdminPage, AdminTable } from '@/components/admin/admin-page';

export const metadata = { title: 'Customers' };

export default function AdminUsersPage() {
  return (
    <AdminPage title="Customers" description="Customer accounts with their orders and reviews.">
      <AdminTable
        columns={['Customer', 'Email', 'Role', 'Orders', 'Joined']}
        empty="No customers yet."
      />
    </AdminPage>
  );
}
