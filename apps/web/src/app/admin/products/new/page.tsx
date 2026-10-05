import { ProductEditorShell } from '@/components/admin/product-editor-shell';

export const metadata = { title: 'New product' };

export default function NewProductPage() {
  return (
    <ProductEditorShell
      title="New product"
      description="Products are saved as drafts until published."
    />
  );
}
