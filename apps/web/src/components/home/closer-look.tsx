'use client';

import { useEffect, useRef, useState } from 'react';
import Link from '@/components/i18n/link';
import { useI18n } from '@/components/i18n/provider';
import { ProductArt } from '@/components/product/product-art';
import type { ProductPreview } from '@/lib/catalog/schemas';
import { cn } from '@/lib/utils';

/** Whole board, then the copper Esc key, then the copper Enter key (positions in the drawing). */
const STAGES = [
  { scale: 1, origin: '50% 50%' },
  { scale: 2.2, origin: '6% 22%' },
  { scale: 3, origin: '86% 48%' },
] as const;

/**
 * One frame, three distances: the board stays pinned while the page scrolls, and the
 * drawing moves in on two details, each with one of the product's own highlights.
 */
export function CloserLook({
  slug,
  preview,
  highlights,
}: {
  slug: string;
  preview: ProductPreview;
  highlights: string[];
}) {
  const { t } = useI18n();
  const copy = t.home.closer;
  const [stage, setStage] = useState(0);
  const markers = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setStage(Number((entry.target as HTMLElement).dataset.stage));
        }
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    for (const marker of markers.current) if (marker) observer.observe(marker);
    return () => {
      observer.disconnect();
    };
  }, []);

  const current = STAGES[stage] ?? STAGES[0];

  return (
    <section aria-labelledby="closer-title" className="relative h-[240vh]">
      {STAGES.map((_, i) => (
        <div
          key={i}
          ref={(node) => {
            markers.current[i] = node;
          }}
          data-stage={i}
          aria-hidden="true"
          className="absolute inset-x-0 h-px"
          style={{ top: `${String(i * 33 + 8)}%` }}
        />
      ))}
      <div className="sticky top-[6.5rem] flex h-[calc(100svh-6.5rem)] flex-col justify-center">
        <div className="container-page grid items-center gap-8 lg:grid-cols-12">
          <h2 id="closer-title" className="display text-[clamp(3.25rem,8vw,8rem)] lg:col-span-12">
            {copy.titleStart}{' '}
            <span
              className={cn(
                'transition-opacity duration-500',
                stage === 0 ? 'opacity-30' : 'opacity-100',
              )}
            >
              {copy.titleEnd}
            </span>
          </h2>
          <div className="relative aspect-[16/9] overflow-hidden bg-stage lg:col-span-8">
            <div
              className="absolute inset-0 flex items-center justify-center p-[6%] transition-transform duration-700 ease-out"
              style={{
                transform: `scale(${String(current.scale)})`,
                transformOrigin: current.origin,
              }}
            >
              <ProductArt preview={preview} quality="full" title={copy.art} className="w-full" />
            </div>
          </div>
          <div className="lg:col-span-4">
            <ol className="grid gap-5">
              {highlights.slice(0, 3).map((highlight, i) => (
                <li
                  key={highlight}
                  className={cn(
                    'text-2xl leading-snug font-semibold tracking-tight transition-opacity duration-500',
                    i === stage ? 'opacity-100' : 'opacity-35',
                  )}
                >
                  {highlight}
                </li>
              ))}
            </ol>
            <Link
              href={`/product/${slug}`}
              className="mt-8 inline-block text-lg font-medium text-brand underline underline-offset-4 hover:no-underline"
            >
              {copy.see}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
