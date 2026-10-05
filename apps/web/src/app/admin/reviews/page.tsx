import { AdminPage } from '@/components/admin/admin-page';
import { ReviewList } from '@/components/admin/reviews-moderation';

export const metadata = { title: 'Reviews' };

export default function AdminReviewsPage() {
  return (
    <AdminPage
      title="Reviews"
      description="Reviews with links, contact details or several reports wait here before going live."
    >
      <ReviewList />
    </AdminPage>
  );
}
