import { AdminPage } from '@/components/admin/admin-page';
import { AnalyticsView } from '@/components/admin/analytics-view';

export const metadata = { title: 'Analytics' };

export default function AdminAnalyticsPage() {
  return (
    <AdminPage
      title="Analytics"
      description="Revenue, orders, average order value and best sellers."
    >
      <AnalyticsView />
    </AdminPage>
  );
}
