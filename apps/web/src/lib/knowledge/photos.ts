import type { PhotoId } from './types';

/** The thesis' own photographs and design drawings (public/images/thesis). */
export const PHOTOS: Record<
  PhotoId,
  { src: string; width: number; height: number; kind: 'photo' | 'drawing' }
> = {
  prototype: { src: '/images/thesis/prototype.webp', width: 645, height: 370, kind: 'photo' },
  pcb: { src: '/images/thesis/pcb.webp', width: 1309, height: 574, kind: 'photo' },
  'case-top': { src: '/images/thesis/case-top.webp', width: 963, height: 446, kind: 'photo' },
  'chip-recovered': {
    src: '/images/thesis/chip-recovered.webp',
    width: 383,
    height: 378,
    kind: 'photo',
  },
  schematic: { src: '/images/thesis/schematic.webp', width: 1163, height: 835, kind: 'drawing' },
  'pcb-layout-top': {
    src: '/images/thesis/pcb-layout-top.webp',
    width: 1493,
    height: 670,
    kind: 'drawing',
  },
  'pcb-layout-bottom': {
    src: '/images/thesis/pcb-layout-bottom.webp',
    width: 1488,
    height: 635,
    kind: 'drawing',
  },
  'drawing-plate': {
    src: '/images/thesis/drawing-plate.webp',
    width: 1002,
    height: 491,
    kind: 'drawing',
  },
  'drawing-case': {
    src: '/images/thesis/drawing-case.webp',
    width: 879,
    height: 461,
    kind: 'drawing',
  },
  'drawing-frame': {
    src: '/images/thesis/drawing-frame.webp',
    width: 1206,
    height: 603,
    kind: 'drawing',
  },
};
