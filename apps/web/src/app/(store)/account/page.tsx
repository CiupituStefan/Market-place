import { AccountOverview } from '@/components/account/account-overview';
import { privatePage } from '@/lib/seo/private';

export const metadata = privatePage('Account');

export default function AccountPage() {
  return (
    <div className="container-page py-10">
      <h1 className="mb-10 text-4xl font-semibold tracking-tight">Account</h1>
      <AccountOverview />
    </div>
  );
}
