'use client';

import { useEffect } from 'react';

/**
 * Lets the `[data-reveal]` blocks below the first screen rise in as they arrive. The page is
 * complete without it: blocks are only hidden once this has run, and never for visitors who
 * ask for reduced motion (see globals.css).
 */
export function Reveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const blocks = [...document.querySelectorAll<HTMLElement>('[data-reveal]')].filter(
      (block) => block.getBoundingClientRect().top > window.innerHeight,
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.reveal = 'shown';
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    for (const block of blocks) {
      block.dataset.reveal = 'pending';
      observer.observe(block);
    }
    return () => {
      observer.disconnect();
      for (const block of blocks) block.dataset.reveal = 'shown';
    };
  }, []);
  return null;
}
