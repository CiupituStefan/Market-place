'use client';

import { useRef, type ReactNode } from 'react';
import { gsap, MOTION_OK, useGSAP } from '@/lib/motion';

/**
 * Moves its content a little slower than the page while it crosses the screen (a few percent
 * of its height), so stacked pictures read as layers at different depths. Static for visitors
 * who reduce motion.
 */
export function Parallax({
  children,
  className,
  depth = 8,
}: {
  children: ReactNode;
  className?: string;
  depth?: number;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo(
          scope.current,
          { yPercent: depth },
          {
            yPercent: -depth,
            ease: 'none',
            scrollTrigger: {
              trigger: scope.current,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        );
      });
      return () => {
        mm.revert();
      };
    },
    { scope },
  );

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}
