import { notFound } from 'next/navigation';
import { z } from 'zod';
import { OrderDetailView } from '@/components/account/orders-view';
import { privatePage } from '@/lib/seo/private';

export const metadata = privatePage('Order');

export default async function OrderPage(props: PageProps<'/account/orders/[id]'>) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  return (
    <div className="container-page py-10">
      <h1 className="mb-10 text-4xl font-semibold tracking-tight">Order details</h1>
      <OrderDetailView orderId={id} />
    </div>
  );
}
