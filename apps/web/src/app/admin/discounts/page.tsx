import { AdminPage, AdminTable } from '@/components/admin/admin-page';

export const metadata = { title: 'Discounts' };

export default function AdminDiscountsPage() {
  return (
    <AdminPage
      title="Discounts"
      description="Percentage and fixed-amount coupons with expiry and usage limits."
    >
      <AdminTable
        columns={['Code', 'Type', 'Value', 'Used / limit', 'Expires', 'Status']}
        empty="No discount codes yet."
      />
    </AdminPage>
  );
}
