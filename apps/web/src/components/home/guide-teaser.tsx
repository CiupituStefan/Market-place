import { ArrowUpRightIcon } from 'lucide-react';
import Link from '@/components/i18n/link';
import { Diagram } from '@/components/knowledge/diagrams';
import { Reveal } from '@/components/motion/reveal';
import type { I18n } from '@/lib/i18n/core';
import { TOPICS } from '@/lib/knowledge/topics';

/** The six topics of the technical guide, each shown by its own drawing. */
export function GuideTeaser({ i18n }: { i18n: I18n }) {
  const { locale } = i18n;
  const copy = i18n.t.home.guide;

  return (
    <section aria-labelledby="guide-title" className="container-page py-24">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h2 id="guide-title" className="display text-[clamp(2.25rem,4.4vw,4rem)]">
            {copy.title}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{copy.intro}</p>
        </div>
      </div>
      <Reveal className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((topic) => (
          <article
            key={topic.slug}
            data-animate
            className="group panel relative flex flex-col p-3 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-lg motion-reduce:hover:translate-y-0"
          >
            <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-stage p-6">
              <Diagram
                id={topic.emblem}
                locale={locale}
                title={topic.title[locale]}
                className="max-h-full w-full"
              />
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h3 className="text-xl font-semibold tracking-tight">
                <Link
                  href={`/learn/${topic.slug}`}
                  className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-ring/60"
                >
                  {topic.name[locale]}
                </Link>
              </h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
                {topic.summary[locale]}
              </p>
              <p className="mt-auto flex items-center gap-1 pt-4 text-sm font-semibold text-brand">
                <span aria-hidden="true">{copy.read(topic.name[locale])}</span>
                <ArrowUpRightIcon
                  aria-hidden="true"
                  className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </p>
            </div>
          </article>
        ))}
      </Reveal>
    </section>
  );
}
