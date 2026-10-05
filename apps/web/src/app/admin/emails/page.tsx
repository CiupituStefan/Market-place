import { AdminPage } from '@/components/admin/admin-page';
import { EmailsView } from '@/components/admin/emails-view';

export const metadata = { title: 'Emails' };

export default function AdminEmailsPage() {
  return (
    <AdminPage
      title="Emails"
      description="Every email the shop sent, suppressed or could not deliver."
    >
      <EmailsView />
    </AdminPage>
  );
}
