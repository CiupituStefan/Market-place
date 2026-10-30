'use client';

import { CheckIcon, MinusIcon } from 'lucide-react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { useRef, useState, type ReactNode } from 'react';
import { EASE, gsap, MOTION_OK, useGSAP } from '@/lib/motion';
import { cn } from '@/lib/utils';

export interface ExplorerItem {
  id: string;
  name: string;
  summary: string;
  pros: string[];
  cons: string[];
  figure: ReactNode;
}

/**
 * Several alternatives of one thing (the six ways to mount a plate) compared in one place: pick
 * one, see its drawing and what it does well and less well. Tabs, so it works from the keyboard
 * (arrow keys); every panel is in the page (inactive ones hidden), so all of them are there
 * without script and for search engines. The new panel's parts rise in on change.
 */
export function OptionsExplorer({
  label,
  items,
  prosLabel,
  consLabel,
  headingLevel = 3,
}: {
  label: string;
  /** 3 directly under a chapter heading, 4 under the block's own title. */
  headingLevel?: 3 | 4;
  items: ExplorerItem[];
  prosLabel: string;
  consLabel: string;
}) {
  const Heading = headingLevel === 4 ? 'h4' : 'h3';
  const [value, setValue] = useState(items[0]?.id ?? '');
  const scope = useRef<HTMLDivElement>(null);
  const changed = useRef(false);

  useGSAP(
    () => {
      if (!changed.current) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo(
          `[data-explorer-panel="${value}"] [data-explorer-anim]`,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.5, ease: EASE, stagger: 0.06 },
        );
      });
      return () => {
        mm.revert();
      };
    },
    { scope, dependencies: [value] },
  );

  const change = (next: string) => {
    changed.current = true;
    setValue(next);
  };

  return (
    <div ref={scope} className="glass rounded-3xl p-3 sm:p-4">
      <TabsPrimitive.Root value={value} onValueChange={change}>
        <TabsPrimitive.List
          aria-label={label}
          className="flex gap-1 overflow-x-auto rounded-2xl bg-foreground/[0.05] p-1.5 [scrollbar-width:none]"
        >
          {items.map((item) => (
            <TabsPrimitive.Trigger
              key={item.id}
              value={item.id}
              className="h-10 shrink-0 rounded-xl px-4 text-sm font-semibold text-muted-foreground transition-[background-color,color,box-shadow] duration-200 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              {item.name}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
        {items.map((item) => (
          <TabsPrimitive.Content
            key={item.id}
            value={item.id}
            forceMount
            data-explorer-panel={item.id}
            className="grid gap-6 p-3 pt-6 outline-none data-[state=inactive]:hidden sm:p-5 lg:grid-cols-2 lg:items-center"
          >
            <div data-explorer-anim className="rounded-2xl bg-stage p-5">
              {item.figure}
            </div>
            <div>
              <Heading data-explorer-anim className="text-2xl font-semibold tracking-tight">
                {item.name}
              </Heading>
              <p data-explorer-anim className="mt-3 text-lg leading-relaxed">
                {item.summary}
              </p>
              <div data-explorer-anim className="mt-6 grid gap-5 sm:grid-cols-2">
                {[
                  { title: prosLabel, list: item.pros, icon: CheckIcon, tone: 'text-success' },
                  { title: consLabel, list: item.cons, icon: MinusIcon, tone: 'text-copper' },
                ]
                  .filter((group) => group.list.length > 0)
                  .map((group) => (
                    <div key={group.title}>
                      <p className="text-sm font-semibold">{group.title}</p>
                      <ul className="mt-2 space-y-2">
                        {group.list.map((line) => (
                          <li key={line} className="flex gap-2 text-[0.9375rem] leading-snug">
                            <group.icon
                              aria-hidden="true"
                              className={cn('mt-0.5 size-4 shrink-0', group.tone)}
                            />
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            </div>
          </TabsPrimitive.Content>
        ))}
      </TabsPrimitive.Root>
    </div>
  );
}
