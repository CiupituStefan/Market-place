'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * The header's floating bar. It sits flush at the top of the page and turns into a frosted
 * panel once the page moves under it (`data-scrolled`), so the glass only appears when there
 * is something behind it to frost.
 */
export function HeaderFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => {
      node.dataset.scrolled = window.scrollY > 8 ? 'true' : 'false';
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-scrolled="false"
      className="group/header container-page flex h-16 items-center gap-3 rounded-2xl border border-transparent transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 data-[scrolled=true]:glass-strong"
    >
      {children}
    </div>
  );
}
