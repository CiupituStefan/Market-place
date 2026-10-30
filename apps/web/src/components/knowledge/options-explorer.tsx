'use client';

import { CheckIcon, MinusIcon } from 'lucide-react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { useRef, useState, type ReactNode } from 'react';
import { EASE, gsap, MOTION_OK } from '@/lib/motion';
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
 * (arrow keys) and reads as a list without script; the drawing crossfades on change.
 */
export function OptionsExplorer({
  label,
  items,
  prosLabel,
  consLabel,
}: {
  label: string;
  items: ExplorerItem[];
  prosLabel: string;
  consLabel: string;
}) {
  const [value, setValue] = useState(items[0]?.id ?? '');
  const scope = useRef<HTMLDivElement>(null);
  // The new panel's parts rise in (a one-off tween started by the choice).
  const change = (next: string) => {
    setValue(next);
    if (!window.matchMedia(MOTION_OK).matches) return;
    requestAnimationFrame(() => {
      const panel = scope.current?.querySelector('[data-state="active"][data-explorer-panel]');
      if (!panel) return;
      gsap.fromTo(
        panel.querySelectorAll('[data-explorer-anim]'),
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.5, ease: EASE, stagger: 0.06 },
      );
    });
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
            data-explorer-panel
            className="grid gap-6 p-3 pt-6 outline-none sm:p-5 lg:grid-cols-2 lg:items-center"
          >
            <div data-explorer-anim className="rounded-2xl bg-stage p-5">
              {item.figure}
            </div>
            <div>
              <h4 data-explorer-anim className="text-2xl font-semibold tracking-tight">
                {item.name}
              </h4>
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
