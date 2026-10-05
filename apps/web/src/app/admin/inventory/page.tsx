import { AdminPage, AdminTable } from '@/components/admin/admin-page';

export const metadata = { title: 'Inventory' };

export default function AdminInventoryPage() {
  return (
    <AdminPage
      title="Inventory"
      description="On-hand stock, active reservations and the stock movement ledger."
    >
      <AdminTable
        columns={['SKU', 'Product', 'On hand', 'Reserved', 'Available', 'Reorder point']}
        empty="No inventory records yet."
      />
    </AdminPage>
  );
}
