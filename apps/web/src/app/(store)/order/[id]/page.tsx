import { notFound } from 'next/navigation';
import { z } from 'zod';
import { OrderDetail } from '@/components/orders/order-detail';
import { privatePage } from '@/lib/seo/private';

export const metadata = privatePage('Your order');

/** Order confirmation and status, for signed-in owners and for the guest who placed it. */
export default async function OrderConfirmationPage(props: PageProps<'/order/[id]'>) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  return (
    <div className="container-page py-10">
      <h1 className="mb-10 text-4xl font-semibold tracking-tight">Your order</h1>
      <OrderDetail orderId={id} backHref={null} />
    </div>
  );
}
