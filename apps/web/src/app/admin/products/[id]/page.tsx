import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ProductEditorShell } from '@/components/admin/product-editor-shell';

export const metadata = { title: 'Edit product' };

export default async function EditProductPage(props: PageProps<'/admin/products/[id]'>) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  return <ProductEditorShell title="Edit product" description={`Product ${id}`} />;
}
