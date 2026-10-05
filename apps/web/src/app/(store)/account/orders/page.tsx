import { OrdersView } from '@/components/account/orders-view';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { privatePage } from '@/lib/seo/private';

export const metadata = privatePage('Orders');

export default function OrdersPage() {
  return (
    <div className="container-page py-10">
      <Breadcrumbs
        crumbs={[
          { name: 'Account', href: '/account' },
          { name: 'Orders', href: '/account/orders' },
        ]}
      />
      <h1 className="mt-6 mb-10 text-4xl font-semibold tracking-tight">Orders</h1>
      <OrdersView />
    </div>
  );
}
