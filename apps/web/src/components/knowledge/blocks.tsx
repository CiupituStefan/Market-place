import { CheckIcon, MinusIcon } from 'lucide-react';
import Image from 'next/image';
import { Diagram } from '@/components/knowledge/diagrams';
import type { I18n } from '@/lib/i18n/core';
import { PHOTOS } from '@/lib/knowledge/photos';
import type { Block } from '@/lib/knowledge/types';
import { cn } from '@/lib/utils';
import { OptionsExplorer } from './options-explorer';

/** Renders one block of the guide (see lib/knowledge/types.ts) in the page's language. */
export function KnowledgeBlock({ block, i18n }: { block: Block; i18n: I18n }) {
  const { locale } = i18n;
  const copy = i18n.t.learn;

  switch (block.kind) {
    case 'prose':
      return (
        <div className="max-w-[68ch] space-y-4 text-lg leading-relaxed">
          {block.paragraphs.map((paragraph) => (
            <p key={paragraph.en}>{paragraph[locale]}</p>
          ))}
        </div>
      );

    case 'callout':
      return (
        <div
          role="note"
          className="glass relative max-w-[68ch] overflow-hidden rounded-2xl p-5 pl-7 sm:p-6 sm:pl-8"
        >
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand" />
          <p className="font-semibold">{block.title[locale]}</p>
          <p className="mt-2 leading-relaxed text-foreground/90">{block.body[locale]}</p>
        </div>
      );

    case 'terms':
      return (
        <div>
          {block.title && <h3 className="mb-4 text-xl font-semibold">{block.title[locale]}</h3>}
          <dl className="grid gap-3 sm:grid-cols-2">
            {block.items.map((item) => (
              <div key={item.term.en} className="panel rounded-2xl p-5">
                <dt className="font-semibold">{item.term[locale]}</dt>
                <dd className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
                  {item.body[locale]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      );

    case 'options': {
      const withDrawings = block.items.every((item) => item.diagram);
      if (withDrawings && block.items.length > 1) {
        return (
          <div>
            {block.title && <h3 className="mb-4 text-xl font-semibold">{block.title[locale]}</h3>}
            <OptionsExplorer
              label={
                block.title?.[locale] ??
                `${copy.compare}: ${block.items.map((item) => item.name[locale]).join(', ')}`
              }
              headingLevel={block.title ? 4 : 3}
              prosLabel={copy.pros}
              consLabel={copy.cons}
              items={block.items.map((item) => ({
                id: item.name.en
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, ''),
                name: item.name[locale],
                summary: item.summary[locale],
                pros: (item.pros ?? []).map((line) => line[locale]),
                cons: (item.cons ?? []).map((line) => line[locale]),
                figure: item.diagram ? (
                  <Diagram id={item.diagram} locale={locale} title={item.name[locale]} />
                ) : null,
              }))}
            />
          </div>
        );
      }
      // Cards sit under the block's own title when it has one, else directly under the chapter.
      const Heading = block.title ? 'h4' : 'h3';
      return (
        <div>
          {block.title && <h3 className="mb-4 text-xl font-semibold">{block.title[locale]}</h3>}
          <div
            className={cn(
              'grid gap-3',
              block.items.length > 2 ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2',
            )}
          >
            {block.items.map((item) => (
              <article key={item.name.en} className="panel flex flex-col rounded-2xl p-5">
                {item.diagram && (
                  <div className="mb-4 rounded-xl bg-stage p-4">
                    <Diagram id={item.diagram} locale={locale} title={item.name[locale]} />
                  </div>
                )}
                <Heading className="text-lg font-semibold">{item.name[locale]}</Heading>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
                  {item.summary[locale]}
                </p>
                {(item.pros?.length ?? 0) + (item.cons?.length ?? 0) > 0 && (
                  <ul className="mt-4 space-y-2 border-t border-border pt-4">
                    {(item.pros ?? []).map((line) => (
                      <li key={`+${line.en}`} className="flex gap-2 text-[0.9375rem] leading-snug">
                        <CheckIcon
                          role="img"
                          aria-label={copy.pros}
                          className="mt-0.5 size-4 shrink-0 text-success"
                        />
                        {line[locale]}
                      </li>
                    ))}
                    {(item.cons ?? []).map((line) => (
                      <li key={`-${line.en}`} className="flex gap-2 text-[0.9375rem] leading-snug">
                        <MinusIcon
                          role="img"
                          aria-label={copy.cons}
                          className="mt-0.5 size-4 shrink-0 text-copper"
                        />
                        {line[locale]}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </div>
      );
    }

    case 'table':
      return (
        <figure>
          <figcaption className="mb-4 text-xl font-semibold">{block.title[locale]}</figcaption>
          <div className="panel overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[40rem] border-collapse text-left text-[0.9375rem]">
              <thead>
                <tr className="border-b border-border bg-foreground/[0.03]">
                  {block.columns.map((column) => (
                    <th key={column.en} scope="col" className="px-4 py-3 font-semibold">
                      {column[locale]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={row[0]?.en ?? r} className="border-b border-border last:border-0">
                    {row.map((cell, c) =>
                      c === (block.rowHeader ?? 0) ? (
                        <th key={c} scope="row" className="px-4 py-3 align-top font-semibold">
                          {cell[locale]}
                        </th>
                      ) : (
                        <td key={c} className="px-4 py-3 align-top text-foreground/85">
                          {cell[locale]}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      );

    case 'steps':
      return (
        <div>
          {block.title && <h3 className="mb-4 text-xl font-semibold">{block.title[locale]}</h3>}
          <ol className="relative space-y-3 border-l border-border pl-8">
            {block.items.map((item, i) => (
              <li key={item.title.en} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute top-4 -left-[2.65rem] flex size-7 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground tabular-nums"
                >
                  {i + 1}
                </span>
                <div className="panel rounded-2xl p-5">
                  <p className="font-semibold">{item.title[locale]}</p>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
                    {item.body[locale]}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      );

    case 'specs':
      return (
        <div>
          {block.title && <h3 className="mb-4 text-xl font-semibold">{block.title[locale]}</h3>}
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {block.items.map((item) => (
              <div key={item.label.en} className="panel rounded-2xl p-4">
                <dt className="text-sm text-muted-foreground">{item.label[locale]}</dt>
                <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
                  {item.value}
                </dd>
                {item.note && (
                  <dd className="mt-1 text-sm text-muted-foreground">{item.note[locale]}</dd>
                )}
              </div>
            ))}
          </dl>
        </div>
      );

    case 'diagram':
      return (
        <figure>
          <div className="glass rounded-3xl p-5 sm:p-8">
            <Diagram
              id={block.diagram}
              locale={locale}
              title={block.caption[locale]}
              className="mx-auto max-w-2xl"
            />
          </div>
          <figcaption className="mt-3 text-sm text-muted-foreground">
            {block.caption[locale]}
          </figcaption>
        </figure>
      );

    case 'photo': {
      const photo = PHOTOS[block.photo];
      return (
        <figure>
          <div
            className={cn(
              'overflow-hidden rounded-3xl bg-white',
              photo.kind === 'photo' ? 'p-6 sm:p-10' : 'p-2 sm:p-3',
            )}
          >
            <Image
              src={photo.src}
              width={photo.width}
              height={photo.height}
              alt={block.caption[locale]}
              sizes="(min-width: 1024px) 760px, 100vw"
              className={cn('mx-auto h-auto w-full', photo.kind === 'photo' && 'max-w-2xl')}
            />
          </div>
          <figcaption className="mt-3 text-sm text-muted-foreground">
            {block.caption[locale]}
          </figcaption>
        </figure>
      );
    }
  }
}
