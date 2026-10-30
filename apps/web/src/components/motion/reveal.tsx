'use client';

import { useRef, type ReactNode } from 'react';
import { EASE, gsap, MOTION_OK, ScrollTrigger, useGSAP } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Lets the `[data-animate]` children of a section rise in, in order, the first time they come
 * into view. The page is complete without it: nothing is hidden until this has run, things
 * already on screen are left alone, and nothing moves for visitors who reduce motion.
 */
export function Reveal({
  children,
  className,
  stagger = 0.08,
  distance = 28,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  distance?: number;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const marked = gsap.utils.toArray<HTMLElement>('[data-animate]', root);
        const all = marked.length > 0 ? marked : [root];
        const below = all.filter(
          (el) => el.getBoundingClientRect().top > window.innerHeight * 0.92,
        );
        if (below.length === 0) return;
        gsap.set(below, { autoAlpha: 0, y: distance });
        ScrollTrigger.batch(below, {
          start: 'top 90%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.9, ease: EASE, stagger }),
        });
      });
      return () => {
        mm.revert();
      };
    },
    { scope },
  );

  return (
    <div ref={scope} className={cn(className)}>
      {children}
    </div>
  );
}
