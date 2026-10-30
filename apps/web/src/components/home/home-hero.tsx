'use client';

import { ArrowRightIcon } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import Link from '@/components/i18n/link';
import { useI18n } from '@/components/i18n/provider';
import { ProductArt } from '@/components/product/product-art';
import type { Money } from '@market/types';
import type { ProductPreview } from '@/lib/catalog/schemas';
import { cn } from '@/lib/utils';

export interface HeroBoard {
  slug: string;
  name: string;
  tagline: string;
  layout: string;
  price: Money;
  preview: ProductPreview;
}

/** Where the seam cuts the two-line headline, in ems of the headline (line-height 0.86). */
const SEAM = 1.15;
const BELOW = 2 * 0.86 - SEAM;

/**
 * Two fields, paper over blue, with the headline across the seam. The blue field holds the
 * one thing to do here: pick a size, and see the CSE keyboard made in that size, with its
 * real name, description and price.
 */
export function HomeHero({ boards }: { boards: HeroBoard[] }) {
  const { t, money } = useI18n();
  const copy = t.home.hero;
  const initial = Math.max(
    0,
    boards.findIndex((board) => board.layout === '75%'),
  );
  const [index, setIndex] = useState(initial);
  const board = boards[index];

  const size = { '--hero-size': 'clamp(4rem, 10vw, 10rem)' } as CSSProperties;

  return (
    <section aria-labelledby="hero-title" style={size}>
      <div className="bg-background pt-[clamp(2rem,6svh,4.5rem)]">
        <div
          className="relative mx-auto w-fit px-4 text-[length:var(--hero-size)]"
          style={{ marginBottom: `-${String(BELOW)}em` }}
        >
          <h1 id="hero-title" className="display relative text-center whitespace-pre-line">
            <span
              className="block"
              style={{ clipPath: `inset(0 0 calc(100% - ${String(SEAM)}em) 0)` }}
            >
              {copy.title}
            </span>
            {/* The same words below the seam, in the blue field's ink. */}
            <span
              aria-hidden="true"
              className="absolute inset-0 text-brand-foreground"
              style={{ clipPath: `inset(${String(SEAM)}em 0 0 0)` }}
            >
              {copy.title}
            </span>
          </h1>
        </div>
      </div>

      <div
        className="bg-brand text-brand-foreground"
        style={{ paddingTop: `calc(var(--hero-size) * ${String(BELOW)} + 2.5rem)` }}
      >
        <div className="container-page grid items-center gap-10 pb-20 lg:grid-cols-12 lg:gap-8 lg:pb-28">
          <div className="lg:col-span-5">
            <p className="max-w-md text-xl leading-snug">{copy.body}</p>

            {boards.length > 0 && board && (
              <>
                <div role="group" aria-label={copy.sizes} className="mt-6 flex flex-wrap gap-2">
                  {boards.map((item, i) => (
                    <button
                      key={item.slug}
                      type="button"
                      aria-pressed={i === index}
                      onClick={() => {
                        setIndex(i);
                      }}
                      className={cn(
                        'h-12 min-w-16 px-4 text-lg font-semibold tabular-nums transition-[background-color,color,transform] duration-150 active:translate-y-px',
                        i === index
                          ? 'bg-brand-foreground text-brand'
                          : 'bg-brand-foreground/12 hover:bg-brand-foreground/25',
                      )}
                    >
                      {item.layout}
                    </button>
                  ))}
                </div>

                <div aria-live="polite" className="mt-8">
                  <p className="text-3xl font-semibold tracking-tight">{board.name}</p>
                  <p className="mt-2 text-lg">{board.tagline}</p>
                  <p className="mt-2 text-lg font-semibold tabular-nums">
                    {copy.from(money(board.price))}
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
                  <Link
                    href={`/product/${board.slug}`}
                    className="inline-flex h-13 items-center gap-2 bg-brand-foreground px-7 text-base font-semibold text-brand transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {copy.see(board.name)} <ArrowRightIcon className="size-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href="/configurator"
                    className="text-base font-medium underline underline-offset-4 hover:no-underline"
                  >
                    {copy.build}
                  </Link>
                </div>
              </>
            )}
          </div>

          {board && (
            <div className="lg:col-span-7">
              <ProductArt
                key={board.slug}
                preview={board.preview}
                quality="full"
                title={copy.art(board.name)}
                className="w-full animate-in duration-500 fade-in slide-in-from-right-6"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
