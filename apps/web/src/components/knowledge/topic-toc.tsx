'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The chapters of a topic, with the one being read marked. A column beside the text on wide
 * screens and a scrollable row of chips under the header on narrow ones.
 */
export function TopicToc({
  label,
  chapters,
}: {
  label: string;
  chapters: { id: string; title: string }[];
}) {
  const [active, setActive] = useState(chapters[0]?.id ?? '');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        const first = visible.sort(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
        )[0];
        if (first) setActive(first.target.id);
      },
      { rootMargin: '-25% 0px -60% 0px' },
    );
    for (const chapter of chapters) {
      const node = document.getElementById(chapter.id);
      if (node) observer.observe(node);
    }
    return () => {
      observer.disconnect();
    };
  }, [chapters]);

  return (
    <nav aria-label={label}>
      <p className="mb-3 hidden text-sm font-semibold lg:block">{label}</p>
      <ol className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:flex-col lg:gap-0.5 lg:overflow-visible">
        {chapters.map((chapter, i) => (
          <li key={chapter.id} className="shrink-0">
            <a
              href={`#${chapter.id}`}
              aria-current={active === chapter.id ? 'location' : undefined}
              className={cn(
                'flex items-baseline gap-3 rounded-full border border-border px-3.5 py-1.5 text-sm transition-colors lg:rounded-xl lg:border-0 lg:py-2',
                active === chapter.id
                  ? 'bg-foreground/[0.07] font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
              )}
            >
              <span className="hidden tabular-nums lg:inline">
                {String(i + 1).padStart(2, '0')}
              </span>
              {chapter.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
