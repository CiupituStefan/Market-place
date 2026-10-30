import type { Metadata } from 'next';
import { ArrowLeftIcon, ArrowRightIcon, ArrowUpRightIcon } from 'lucide-react';
import { notFound } from 'next/navigation';
import Link from '@/components/i18n/link';
import { KnowledgeBlock } from '@/components/knowledge/blocks';
import { TopicToc } from '@/components/knowledge/topic-toc';
import { Reveal } from '@/components/motion/reveal';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { getI18n } from '@/lib/i18n/server';
import { getTopic, TOPICS } from '@/lib/knowledge/topics';
import { localizedAlternates } from '@/lib/seo/alternates';

/** Per request, like every page: see the CSP nonce note in product/[slug]/page.tsx. */
export const dynamic = 'force-dynamic';

export async function generateMetadata(props: PageProps<'/learn/[topic]'>): Promise<Metadata> {
  const { topic: slug } = await props.params;
  const { locale } = await getI18n();
  const topic = getTopic(slug);
  if (!topic) return {};
  return {
    title: topic.title[locale],
    description: topic.summary[locale],
    alternates: localizedAlternates(`/learn/${topic.slug}`, locale),
  };
}

/** Thesis chapters a group of blocks comes from, in reading order, without repeats. */
function sections(blocks: { section: string }[]): string {
  return [...new Set(blocks.map((block) => block.section))].join(', ');
}

/** One topic of the guide: its chapters with a contents column, the shop links, prev/next. */
export default async function TopicPage(props: PageProps<'/learn/[topic]'>) {
  const { topic: slug } = await props.params;
  const i18n = await getI18n();
  const { t, locale } = i18n;
  const copy = t.learn;
  const topic = getTopic(slug);
  if (!topic) notFound();

  const index = TOPICS.findIndex((item) => item.slug === topic.slug);
  const previous = index > 0 ? TOPICS[index - 1] : undefined;
  const next = index < TOPICS.length - 1 ? TOPICS[index + 1] : undefined;

  return (
    <div className="container-page pt-8 pb-12">
      <Breadcrumbs
        crumbs={[
          { name: t.shop.home, href: '/' },
          { name: copy.title, href: '/learn' },
          { name: topic.name[locale], href: `/learn/${topic.slug}` },
        ]}
      />
      <header className="mt-8 max-w-3xl">
        <p className="text-sm font-semibold text-copper tabular-nums">
          {String(index + 1).padStart(2, '0')} / {String(TOPICS.length).padStart(2, '0')} ·{' '}
          {topic.name[locale]}
        </p>
        <h1 className="display mt-3 text-[clamp(2.5rem,5.4vw,4.75rem)]">{topic.title[locale]}</h1>
        <p className="mt-5 text-xl leading-relaxed text-muted-foreground">
          {topic.summary[locale]}
        </p>
      </header>

      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="sticky top-[6.75rem] z-20 -mx-4 min-w-0 bg-background/85 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-28 lg:mx-0 lg:self-start lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <TopicToc
            label={copy.onThisPage}
            chapters={topic.chapters.map((chapter) => ({
              id: chapter.id,
              title: chapter.title[locale],
            }))}
          />
        </aside>

        <div className="min-w-0">
          {topic.chapters.map((chapter) => (
            <section
              key={chapter.id}
              id={chapter.id}
              aria-labelledby={`${chapter.id}-title`}
              className="scroll-mt-40 border-t border-border py-12 first:border-t-0 first:pt-0 lg:scroll-mt-28"
            >
              <h2
                id={`${chapter.id}-title`}
                className="text-[clamp(1.75rem,2.8vw,2.5rem)] font-semibold tracking-tight"
              >
                {chapter.title[locale]}
              </h2>
              <Reveal className="mt-6 space-y-8" stagger={0.06} distance={20}>
                {chapter.blocks.map((block, i) => (
                  <div key={`${chapter.id}-${String(i)}`} data-animate>
                    <KnowledgeBlock block={block} i18n={i18n} />
                  </div>
                ))}
              </Reveal>
              <p className="mt-8 text-sm text-muted-foreground">
                {copy.source(sections(chapter.blocks))}
              </p>
            </section>
          ))}

          {topic.related.length > 0 && (
            <section aria-labelledby="related-title" className="glass mt-6 rounded-3xl p-6 sm:p-8">
              <h2 id="related-title" className="text-xl font-semibold">
                {copy.related}
              </h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {topic.related.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-4 py-2 text-[0.9375rem] font-medium transition-colors hover:border-foreground/30"
                    >
                      {link.label[locale]}{' '}
                      <ArrowUpRightIcon className="size-4" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <nav
            aria-label={copy.allTopics}
            className="mt-10 grid gap-3 border-t border-border pt-8 sm:grid-cols-2"
          >
            {previous ? (
              <Link
                href={`/learn/${previous.slug}`}
                className="panel group rounded-2xl p-5 transition-colors hover:border-foreground/25"
              >
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ArrowLeftIcon className="size-4" aria-hidden="true" /> {copy.previous}
                </span>
                <span className="mt-1 block text-lg font-semibold">{previous.title[locale]}</span>
              </Link>
            ) : (
              <Link
                href="/learn"
                className="panel rounded-2xl p-5 transition-colors hover:border-foreground/25"
              >
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ArrowLeftIcon className="size-4" aria-hidden="true" /> {copy.allTopics}
                </span>
                <span className="mt-1 block text-lg font-semibold">{copy.title}</span>
              </Link>
            )}
            {next && (
              <Link
                href={`/learn/${next.slug}`}
                className="panel rounded-2xl p-5 text-right transition-colors hover:border-foreground/25"
              >
                <span className="flex items-center justify-end gap-1.5 text-sm text-muted-foreground">
                  {copy.next} <ArrowRightIcon className="size-4" aria-hidden="true" />
                </span>
                <span className="mt-1 block text-lg font-semibold">{next.title[locale]}</span>
              </Link>
            )}
          </nav>
          <p className="mt-8 max-w-2xl text-sm text-muted-foreground">{copy.sourceNote}</p>
        </div>
      </div>
    </div>
  );
}
