import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { contentPages } from '@/lib/content';

/** Own keys only: `/constructor` or `/toString` must be a 404, not a prototype method. */
const contentOf = (page: string) =>
  Object.hasOwn(contentPages, page) ? contentPages[page] : undefined;

/** Per request, like every page: see the CSP nonce note in product/[slug]/page.tsx. */
export const dynamic = 'force-dynamic';

export async function generateMetadata(props: PageProps<'/[page]'>): Promise<Metadata> {
  const { page } = await props.params;
  const content = contentOf(page);
  if (!content) return {};
  return {
    title: content.title,
    description: content.description,
    alternates: { canonical: `/${page}` },
  };
}

export default async function ContentPage(props: PageProps<'/[page]'>) {
  const { page } = await props.params;
  const content = contentOf(page);
  if (!content) notFound();
  return (
    <article className="container-page max-w-3xl py-16">
      <h1 className="text-4xl font-semibold tracking-tight">{content.title}</h1>
      <p className="mt-4 text-lg text-muted-foreground">{content.description}</p>
      <div className="mt-12 grid gap-10">
        {content.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-semibold">{section.heading}</h2>
            <p className="mt-3 text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
