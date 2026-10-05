import { AdminPage } from '@/components/admin/admin-page';
import { DiscountsView } from '@/components/admin/discounts-view';

export const metadata = { title: 'Discounts' };

export default function AdminDiscountsPage() {
  return (
    <AdminPage
      title="Discounts"
      description="Percentage and fixed-amount codes with limits and expiry."
    >
      <DiscountsView />
    </AdminPage>
  );
}
