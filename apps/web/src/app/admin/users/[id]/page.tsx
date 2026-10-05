import { CustomerDetail } from '@/components/admin/customers-view';

export const metadata = { title: 'Customer' };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerDetail id={id} />;
}
