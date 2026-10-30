'use client';

import type { Money } from '@market/types';
import { ArrowRightIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import Link from '@/components/i18n/link';
import { useI18n } from '@/components/i18n/provider';
import { ProductArt } from '@/components/product/product-art';
import { Button } from '@/components/ui/button';
import type { ProductPreview } from '@/lib/catalog/schemas';
import { EASE, FINE_POINTER, gsap, MOTION_OK, useGSAP } from '@/lib/motion';
import { cn } from '@/lib/utils';

export interface HeroBoard {
  slug: string;
  name: string;
  tagline: string;
  layout: string;
  price: Money;
  preview: ProductPreview;
}

/**
 * The first screen: what the shop is, in large type, and the one thing to try here: pick a
 * size and see the keyboard made in that size on a glass stage, with its real name and price.
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
  const scope = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLDivElement>(null);

  // Entrance: the headline lines rise, then the text, then the stage settles into place.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap
          .timeline({ defaults: { ease: EASE } })
          .from('[data-hero-line]', { yPercent: 60, autoAlpha: 0, duration: 0.9, stagger: 0.09 })
          .from('[data-hero-fade]', { y: 16, autoAlpha: 0, duration: 0.7, stagger: 0.07 }, '-=0.5')
          .from(
            stage.current,
            { y: 36, scale: 0.97, autoAlpha: 0, duration: 1.1, ease: 'expo.out' },
            '-=0.8',
          );
      });
      // A slight tilt that follows the pointer, so the stage reads as an object in space.
      mm.add(`${MOTION_OK} and ${FINE_POINTER}`, () => {
        const node = stage.current;
        if (!node) return;
        const rx = gsap.quickTo(node, 'rotationX', { duration: 0.6, ease: 'power2.out' });
        const ry = gsap.quickTo(node, 'rotationY', { duration: 0.6, ease: 'power2.out' });
        gsap.set(node, { transformPerspective: 1200 });
        const move = (event: PointerEvent) => {
          const box = node.getBoundingClientRect();
          ry(((event.clientX - box.left) / box.width - 0.5) * 6);
          rx(-((event.clientY - box.top) / box.height - 0.5) * 6);
        };
        const leave = () => {
          rx(0);
          ry(0);
        };
        node.addEventListener('pointermove', move);
        node.addEventListener('pointerleave', leave);
        return () => {
          node.removeEventListener('pointermove', move);
          node.removeEventListener('pointerleave', leave);
        };
      });
      return () => {
        mm.revert();
      };
    },
    { scope },
  );

  // Changing the size slides the new keyboard in (a one-off tween started by the click).
  const choose = (next: number) => {
    if (next === index) return;
    setIndex(next);
    if (!art.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      art.current,
      { x: next > index ? 40 : -40, autoAlpha: 0 },
      { x: 0, autoAlpha: 1, duration: 0.6, ease: EASE },
    );
  };

  const lines = copy.title.split('\n');

  return (
    <section
      ref={scope}
      aria-labelledby="hero-title"
      className="container-page grid items-center gap-12 pt-10 pb-20 lg:grid-cols-12 lg:gap-10 lg:pt-16 lg:pb-28"
    >
      <div className="lg:col-span-6">
        <h1 id="hero-title" className="display text-[clamp(2.6rem,4.6vw,4.5rem)]">
          {lines.map((line) => (
            <span key={line} className="block overflow-hidden pb-[0.06em]">
              <span data-hero-line className="block">
                {line}
              </span>
            </span>
          ))}
        </h1>
        <p data-hero-fade className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          {copy.body}
        </p>
        <div data-hero-fade className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" variant="brand" asChild>
            <Link href="/shop/keyboards">
              {copy.shop} <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/learn">{copy.guide}</Link>
          </Button>
        </div>
      </div>

      {board && (
        <div className="lg:col-span-6">
          <div ref={stage} className="glass rounded-3xl p-4 will-change-transform sm:p-6">
            <div className="relative overflow-hidden rounded-2xl bg-stage/70 px-[6%] py-[8%]">
              <div ref={art}>
                <ProductArt
                  key={board.slug}
                  preview={board.preview}
                  quality="full"
                  title={copy.art(board.name)}
                  className="w-full"
                />
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div aria-live="polite">
                <p className="text-2xl font-semibold tracking-tight">{board.name}</p>
                <p className="mt-1 text-[0.9375rem] text-muted-foreground">{board.tagline}</p>
                <p className="mt-2 text-lg font-semibold tabular-nums">
                  {copy.from(money(board.price))}
                </p>
              </div>
              <Button variant="outline" asChild className="self-start sm:self-auto">
                <Link href={`/product/${board.slug}`}>
                  {copy.see(board.name)} <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <div
              role="group"
              aria-label={copy.sizes}
              className="mt-5 grid grid-cols-3 gap-1.5 rounded-2xl bg-foreground/[0.05] p-1.5 sm:grid-cols-6"
            >
              {boards.map((item, i) => (
                <button
                  key={item.slug}
                  type="button"
                  aria-pressed={i === index}
                  onClick={() => {
                    choose(i);
                  }}
                  className={cn(
                    'h-11 rounded-xl text-[0.9375rem] font-semibold tabular-nums transition-[background-color,color,box-shadow] duration-200',
                    i === index
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
                  )}
                >
                  {item.layout}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
