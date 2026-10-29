import { getI18n } from '@/lib/i18n/server';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { OrderDetail } from '@/components/orders/order-detail';
import { localPrivatePage } from '@/lib/seo/private';

export const generateMetadata = localPrivatePage((t) => t.pages.yourOrder);

/** Order confirmation and status, for signed-in owners and for the guest who placed it. */
export default async function OrderConfirmationPage(props: PageProps<'/order/[id]'>) {
  const { t } = await getI18n();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  return (
    <div className="container-page py-10">
      <h1 className="mb-10 text-4xl font-semibold tracking-tight">{t.pages.yourOrder}</h1>
      <OrderDetail orderId={id} backHref={null} />
    </div>
  );
}
