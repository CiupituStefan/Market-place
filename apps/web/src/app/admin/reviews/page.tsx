import { AdminPage, AdminTable } from '@/components/admin/admin-page';

export const metadata = { title: 'Reviews' };

export default function AdminReviewsPage() {
  return (
    <AdminPage title="Reviews" description="Approve, hide or respond to product reviews.">
      <AdminTable
        columns={['Product', 'Rating', 'Author', 'Verified', 'Status', 'Submitted']}
        empty="No reviews to moderate."
      />
    </AdminPage>
  );
}
