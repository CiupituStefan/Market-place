'use client';

import { ArrowUpRightIcon } from 'lucide-react';
import { useRef } from 'react';
import Link from '@/components/i18n/link';
import { useI18n } from '@/components/i18n/provider';
import { Diagram } from '@/components/knowledge/diagrams';
import { EASE, gsap, MOTION_OK, ScrollTrigger, useGSAP } from '@/lib/motion';

const LAYERS = [
  { part: 'keycaps', guide: '/learn/keycaps', shop: '/shop/keycaps' },
  { part: 'switches', guide: '/learn/switches', shop: '/shop/switches' },
  { part: 'plate', guide: '/learn/mounting', shop: '/configurator' },
  { part: 'pcb', guide: '/learn/wireless', shop: null },
  { part: 'foam', guide: '/learn/mounting', shop: null },
  { part: 'case', guide: '/learn/mounting', shop: '/shop/keyboards' },
] as const;

/**
 * What a keyboard is made of, as a scroll scene: the drawing stays in view while the six
 * layers are explained one by one; it starts assembled, comes apart as the section begins and
 * lights the layer being read. Without motion (or on small screens) it is a drawing above a list.
 */
export function StackScene() {
  const { t, locale } = useI18n();
  const copy = t.home.stack;
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      const mm = gsap.matchMedia();
      mm.add(`${MOTION_OK} and (min-width: 1024px)`, () => {
        const svg = root.querySelector('svg');
        const parts = LAYERS.map((layer) =>
          root.querySelector<SVGGElement>(`[data-part="${layer.part}"]`),
        );
        if (!svg || parts.some((part) => part === null)) return;
        const groups = parts as SVGGElement[];
        root.dataset.scene = 'on';

        // Assembled: every layer pulled most of the way towards the middle of the drawing.
        const middle = svg.viewBox.baseVal.y + svg.viewBox.baseVal.height / 2;
        const offsets = groups.map((group) => {
          const box = group.getBBox();
          return (middle - (box.y + box.height / 2)) * 0.72;
        });
        // Labels only appear once the layers have room for them.
        const labels = svg.querySelectorAll('[data-label]');
        gsap
          .timeline({
            scrollTrigger: { trigger: root, start: 'top 75%', end: 'top 10%', scrub: 0.6 },
          })
          .fromTo(
            groups,
            { y: (i: number) => offsets[i] ?? 0 },
            { y: 0, ease: 'none', stagger: 0.04 },
          )
          .fromTo(labels, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', duration: 0.3 }, '>-0.3');

        // The layer being read is lit; the others step back.
        const items = gsap.utils.toArray<HTMLElement>('[data-layer]', root);
        const light = (active: number) => {
          groups.forEach((group, i) => {
            gsap.to(group, { opacity: i === active ? 1 : 0.28, duration: 0.45, ease: EASE });
          });
          items.forEach((item, i) => {
            item.dataset.active = String(i === active);
          });
        };
        items.forEach((item, i) => {
          ScrollTrigger.create({
            trigger: item,
            start: 'top 55%',
            end: 'bottom 55%',
            onToggle: (self) => {
              if (self.isActive) light(i);
            },
          });
        });
        ScrollTrigger.create({
          trigger: root,
          start: 'top 75%',
          end: 'bottom top',
          onLeaveBack: () => {
            gsap.to(groups, { opacity: 1, duration: 0.3 });
          },
        });
        // The scene's spacing changed the layout: measure again.
        ScrollTrigger.refresh();
      });
      return () => {
        mm.revert();
        if (scope.current) delete scope.current.dataset.scene;
      };
    },
    { scope },
  );

  return (
    <section
      ref={scope}
      aria-labelledby="stack-title"
      className="group/stack container-page grid gap-10 py-24 lg:grid-cols-12 lg:gap-12"
    >
      <div className="lg:col-span-6">
        <div className="lg:sticky lg:top-28">
          <h2 id="stack-title" className="display text-[clamp(2.25rem,4.4vw,4rem)]">
            {copy.title}
          </h2>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">{copy.intro}</p>
          <div className="glass mt-8 rounded-3xl p-5 sm:p-8">
            <Diagram id="exploded-stack" locale={locale} title={copy.art} className="w-full" />
          </div>
        </div>
      </div>
      <ol className="grid gap-4 lg:col-span-6 lg:group-data-[scene=on]/stack:gap-0 lg:group-data-[scene=on]/stack:pt-[28vh] lg:group-data-[scene=on]/stack:pb-[16vh]">
        {LAYERS.map((layer, i) => {
          const text = copy.layers[layer.part];
          return (
            <li
              key={layer.part}
              data-layer={layer.part}
              data-active="false"
              className="panel p-6 transition-[opacity,border-color] duration-500 sm:p-8 lg:group-data-[scene=on]/stack:min-h-[44vh] lg:group-data-[scene=on]/stack:border-transparent lg:group-data-[scene=on]/stack:bg-transparent lg:group-data-[scene=on]/stack:opacity-40 lg:group-data-[scene=on]/stack:data-[active=true]:opacity-100"
            >
              <p className="text-sm font-semibold text-copper tabular-nums">
                {String(i + 1).padStart(2, '0')} / 06
              </p>
              <h3 className="mt-2 text-[clamp(1.75rem,2.6vw,2.5rem)] font-semibold tracking-tight">
                {text.name}
              </h3>
              <p className="mt-4 max-w-lg text-lg leading-relaxed">{text.body}</p>
              <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem] font-medium">
                <Link
                  href={layer.guide}
                  className="inline-flex items-center gap-1 text-brand hover:underline"
                >
                  {copy.guide} <ArrowUpRightIcon className="size-4" aria-hidden="true" />
                </Link>
                {layer.shop && (
                  <Link
                    href={layer.shop}
                    className="inline-flex items-center gap-1 text-foreground/80 hover:text-foreground hover:underline"
                  >
                    {copy.shop} <ArrowUpRightIcon className="size-4" aria-hidden="true" />
                  </Link>
                )}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
