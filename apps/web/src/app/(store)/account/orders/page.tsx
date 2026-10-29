import { getI18n } from '@/lib/i18n/server';
import { OrdersView } from '@/components/account/orders-view';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { localPrivatePage } from '@/lib/seo/private';

export const generateMetadata = localPrivatePage((t) => t.pages.orders);

export default async function OrdersPage() {
  const { t } = await getI18n();
  return (
    <div className="container-page py-10">
      <Breadcrumbs
        crumbs={[
          { name: t.pages.account, href: '/account' },
          { name: t.pages.orders, href: '/account/orders' },
        ]}
      />
      <h1 className="mt-6 mb-10 text-4xl font-semibold tracking-tight">{t.pages.orders}</h1>
      <OrdersView />
    </div>
  );
}
