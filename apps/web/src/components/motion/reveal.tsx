'use client';

import { useRef, type ReactNode } from 'react';
import { EASE, gsap, MOTION_OK, useGSAP } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Lets the `[data-animate]` children of a section rise in, in order, the first time they come
 * into view. The page is complete without it: nothing is hidden until this has run, things
 * already on screen are left alone, nothing moves for visitors who reduce motion, and only
 * opacity and position change, so hidden blocks stay in the tab order and in find-in-page
 * (focusing one, or scrolling past it quickly, shows it at once).
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
        gsap.set(below, { opacity: 0, y: distance });
        let pending = new Set(below);

        // Checked against the elements' positions on every scroll (not on crossing events), so
        // a jump — the Home key, a link to a chapter, a fast fling and back — can't skip one:
        // what is on screen rises in, what was passed appears at once.
        const check = () => {
          if (pending.size === 0) return;
          const rising: Element[] = [];
          const passed: Element[] = [];
          for (const el of pending) {
            const box = el.getBoundingClientRect();
            if (box.bottom < 0) passed.push(el);
            else if (box.top < window.innerHeight * 0.9) rising.push(el);
          }
          if (passed.length > 0) gsap.set(passed, { opacity: 1, y: 0, overwrite: true });
          if (rising.length > 0)
            gsap.to(rising, {
              opacity: 1,
              y: 0,
              duration: 0.9,
              ease: EASE,
              stagger,
              overwrite: true,
            });
          pending = new Set(
            [...pending].filter((el) => !passed.includes(el) && !rising.includes(el)),
          );
          if (pending.size === 0) stop();
        };
        let frame = 0;
        const onScroll = () => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(check);
        };
        const focus = (event: FocusEvent) => {
          const target = (event.target as Element | null)?.closest('[data-animate]');
          if (target && pending.has(target as HTMLElement)) {
            gsap.set(target, { opacity: 1, y: 0, overwrite: true });
            pending.delete(target as HTMLElement);
          }
        };
        const stop = () => {
          window.removeEventListener('scroll', onScroll);
          window.removeEventListener('resize', onScroll);
          root.removeEventListener('focusin', focus);
          cancelAnimationFrame(frame);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        root.addEventListener('focusin', focus);
        check();
        return () => {
          stop();
          gsap.killTweensOf(below);
          gsap.set(below, { clearProps: 'opacity,transform' });
        };
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
