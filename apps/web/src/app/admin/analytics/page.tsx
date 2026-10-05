import { AdminPage, AdminTable } from '@/components/admin/admin-page';

export const metadata = { title: 'Analytics' };

export default function AdminAnalyticsPage() {
  return (
    <AdminPage
      title="Analytics"
      description="Revenue, orders, average order value, best sellers and inventory alerts."
    >
      <AdminTable
        columns={['Product', 'Units sold', 'Revenue', 'Share']}
        empty="Analytics populate once orders are paid."
      />
    </AdminPage>
  );
}
