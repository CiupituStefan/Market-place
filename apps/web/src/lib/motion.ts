'use client';

import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Motion runs only for visitors who have not asked their system to reduce it. */
export const MOTION_OK = '(prefers-reduced-motion: no-preference)';
/** Pointer effects (tilt, magnetic hover) only where there is a fine pointer to follow. */
export const FINE_POINTER = '(hover: hover) and (pointer: fine)';

/** One easing family for the site: quick out, no bounce. */
export const EASE = 'power3.out';

export { gsap, ScrollTrigger, useGSAP };
