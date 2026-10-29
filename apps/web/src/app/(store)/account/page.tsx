import { getI18n } from '@/lib/i18n/server';
import { AccountOverview } from '@/components/account/account-overview';
import { localPrivatePage } from '@/lib/seo/private';

export const generateMetadata = localPrivatePage((t) => t.pages.account);

export default async function AccountPage() {
  const { t } = await getI18n();
  return (
    <div className="container-page py-10">
      <h1 className="mb-10 text-4xl font-semibold tracking-tight">{t.pages.account}</h1>
      <AccountOverview />
    </div>
  );
}
