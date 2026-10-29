import { getI18n } from '@/lib/i18n/server';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { OrderDetailView } from '@/components/account/orders-view';
import { localPrivatePage } from '@/lib/seo/private';

export const generateMetadata = localPrivatePage((t) => t.pages.order);

export default async function OrderPage(props: PageProps<'/account/orders/[id]'>) {
  const { t } = await getI18n();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  return (
    <div className="container-page py-10">
      <h1 className="mb-10 text-4xl font-semibold tracking-tight">{t.pages.orderDetails}</h1>
      <OrderDetailView orderId={id} />
    </div>
  );
}
