import type { Metadata } from 'next';
import { ArrowUpRightIcon } from 'lucide-react';
import Link from '@/components/i18n/link';
import { Diagram } from '@/components/knowledge/diagrams';
import { Reveal } from '@/components/motion/reveal';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { getI18n } from '@/lib/i18n/server';
import { TOPICS } from '@/lib/knowledge/topics';
import { localizedAlternates } from '@/lib/seo/alternates';

/** Per request, like every page: see the CSP nonce note in product/[slug]/page.tsx. */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  return {
    title: t.learn.title,
    description: t.learn.intro,
    alternates: localizedAlternates('/learn', locale),
  };
}

/** The guide's index: six topics, each with its drawing, its summary and its chapters. */
export default async function LearnIndexPage() {
  const { t, locale } = await getI18n();
  const copy = t.learn;

  return (
    <div className="container-page pt-8 pb-12">
      <Breadcrumbs
        crumbs={[
          { name: t.shop.home, href: '/' },
          { name: copy.title, href: '/learn' },
        ]}
      />
      <header className="mt-8 max-w-3xl">
        <h1 className="display text-[clamp(2.75rem,6vw,5.5rem)]">{copy.title}</h1>
        <p className="mt-5 text-xl leading-relaxed text-muted-foreground">{copy.intro}</p>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">{copy.sourceNote}</p>
      </header>

      <Reveal className="mt-14 grid gap-4 md:grid-cols-2">
        {TOPICS.map((topic, i) => (
          <article
            key={topic.slug}
            data-animate
            className="group panel relative grid gap-5 p-3 transition-[border-color,box-shadow] duration-300 hover:border-foreground/20 hover:shadow-lg sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
          >
            <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-stage p-5">
              <Diagram
                id={topic.emblem}
                locale={locale}
                title={topic.title[locale]}
                className="max-h-full w-full"
              />
            </div>
            <div className="flex flex-col p-2 sm:py-4 sm:pr-4">
              <p className="text-sm font-semibold text-copper tabular-nums">
                {String(i + 1).padStart(2, '0')} · {copy.chapters(topic.chapters.length)}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                <Link
                  href={`/learn/${topic.slug}`}
                  className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-ring/60"
                >
                  {topic.title[locale]}
                </Link>
              </h2>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
                {topic.summary[locale]}
              </p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {topic.chapters.map((chapter) => (
                  <li
                    key={chapter.id}
                    className="rounded-full bg-foreground/[0.05] px-2.5 py-1 text-[0.8125rem] text-foreground/80"
                  >
                    {chapter.title[locale]}
                  </li>
                ))}
              </ul>
              <ArrowUpRightIcon
                aria-hidden="true"
                className="mt-auto size-5 self-end text-brand transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </div>
          </article>
        ))}
      </Reveal>
    </div>
  );
}
