import { Suspense } from 'react';
import { AdminPage } from '@/components/admin/admin-page';
import { InventoryView } from '@/components/admin/inventory-view';

export const metadata = { title: 'Inventory' };

export default function AdminInventoryPage() {
  return (
    <AdminPage
      title="Inventory"
      description="Stock levels, received goods, corrections and reservations."
    >
      <Suspense>
        <InventoryView />
      </Suspense>
    </AdminPage>
  );
}
