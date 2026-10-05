import Link from 'next/link';
import { AdminPage, AdminTable } from '@/components/admin/admin-page';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Products' };

export default function AdminProductsPage() {
  return (
    <AdminPage
      title="Products"
      description="Create, edit, publish and price products and their variants."
      actions={
        <Button asChild>
          <Link href="/admin/products/new">New product</Link>
        </Button>
      }
    >
      <AdminTable
        columns={['Product', 'Status', 'Variants', 'Price from', 'Stock', 'Updated']}
        empty="No products yet."
      />
    </AdminPage>
  );
}
