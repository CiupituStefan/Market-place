import { AdminPage } from '@/components/admin/admin-page';
import { NewProductForm } from '@/components/admin/new-product-form';

export const metadata = { title: 'New product' };

export default function NewProductPage() {
  return (
    <AdminPage
      title="New product"
      description="Products start as drafts: add photos and stock, then publish."
      back={{ href: '/admin/products', label: 'Products' }}
    >
      <NewProductForm />
    </AdminPage>
  );
}
