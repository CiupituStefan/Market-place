import { AdminPage } from './admin-page';

const SECTIONS = [
  {
    title: 'Basics',
    body: 'Name, slug, brand, category, description and status (draft / published).',
  },
  {
    title: 'Media',
    body: 'Images uploaded to S3 through pre-signed URLs and served via CloudFront.',
  },
  {
    title: 'Options & variants',
    body: 'Option groups (color, switch, layout) and the SKU, price and stock of each combination.',
  },
  {
    title: 'Attributes',
    body: 'Layout, mounting, connectivity, materials and other filterable specs.',
  },
  { title: 'SEO', body: 'Meta title, description and Open Graph image.' },
];

export function ProductEditorShell({ title, description }: { title: string; description: string }) {
  return (
    <AdminPage title={title} description={description}>
      <div className="grid gap-4">
        {SECTIONS.map((section) => (
          <section key={section.title} className="rounded-2xl border bg-card p-6">
            <h2 className="font-semibold">{section.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>
    </AdminPage>
  );
}
