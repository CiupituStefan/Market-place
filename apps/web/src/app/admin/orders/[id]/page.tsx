import { OrderAdminDetail } from '@/components/admin/order-admin-detail';

export const metadata = { title: 'Order' };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderAdminDetail id={id} />;
}
