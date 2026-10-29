import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { contentPagesByLocale } from '@/lib/content';
import type { Locale } from '@/lib/i18n/config';
import { getI18n } from '@/lib/i18n/server';
import { localizedAlternates } from '@/lib/seo/alternates';

/** Own keys only: `/constructor` or `/toString` must be a 404, not a prototype method. */
const contentOf = (page: string, locale: Locale) => {
  const pages = contentPagesByLocale[locale];
  return Object.hasOwn(pages, page) ? pages[page] : undefined;
};

/** Per request, like every page: see the CSP nonce note in product/[slug]/page.tsx. */
export const dynamic = 'force-dynamic';

export async function generateMetadata(props: PageProps<'/[page]'>): Promise<Metadata> {
  const { page } = await props.params;
  const { locale } = await getI18n();
  const content = contentOf(page, locale);
  if (!content) return {};
  return {
    title: content.title,
    description: content.description,
    alternates: localizedAlternates(`/${page}`, locale),
  };
}

export default async function ContentPage(props: PageProps<'/[page]'>) {
  const { page } = await props.params;
  const { locale } = await getI18n();
  const content = contentOf(page, locale);
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
