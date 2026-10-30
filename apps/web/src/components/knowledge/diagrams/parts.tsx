import { useId, type ReactNode } from 'react';

import type { Locale } from '@/lib/i18n/config';
import type { DiagramId } from '@/lib/knowledge/types';

/**
 * Shared drawing kit for the knowledge-guide diagrams. Every diagram is a plain inline SVG
 * (no hooks, server-component safe) coloured only through the `--diagram-*` CSS variables so
 * the page decides light and dark. All diagrams use the same viewBox width (W) and text size
 * (FS) so that text renders at the same size everywhere: 21 units on a 640-unit-wide drawing
 * stays above 11px when the drawing is ~340px wide on a phone.
 */

export interface DiagramProps {
  locale: Locale;
  className?: string;
  title: string;
}

export const INK = 'var(--diagram-ink)';
export const LINE = 'var(--diagram-line)';
export const FILL = 'var(--diagram-fill)';
export const FILL_2 = 'var(--diagram-fill-2)';
export const ACCENT = 'var(--diagram-accent)';
export const ACCENT_2 = 'var(--diagram-accent-2)';

/** viewBox width shared by every diagram. */
export const W = 640;
/** Text size in viewBox units (≥ 11px at 340px wide). */
export const FS = 21;
/** Line height for multi-line labels. */
export const LH = 26;
/** Outline stroke. */
export const SW = 2;
/** Emphasised stroke. */
export const SW_STRONG = 3;

export function DiagramSvg({
  id,
  title,
  className,
  height,
  children,
}: {
  id: DiagramId;
  title: string;
  className?: string;
  height: number;
  children: ReactNode;
}) {
  // Unique per instance: the same drawing can appear more than once on a page.
  const titleId = `diagram-${id}-${useId().replace(/:/g, '')}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${W} ${height}`}
      role="img"
      aria-labelledby={titleId}
      className={className}
      width="100%"
      style={{ width: '100%', height: 'auto', display: 'block' }}
      fontFamily="inherit"
      fontSize={FS}
      strokeLinejoin="round"
      strokeLinecap="round"
      data-diagram={id}
    >
      <title id={titleId}>{title}</title>
      {children}
    </svg>
  );
}

type Anchor = 'start' | 'middle' | 'end';

/** One or more lines of text; the first baseline is at `y`. */
export function Label({
  x,
  y,
  lines,
  anchor = 'start',
  weight = 400,
  fill = INK,
  lineHeight = LH,
}: {
  x: number;
  y: number;
  lines: string | readonly string[];
  anchor?: Anchor;
  weight?: number;
  fill?: string;
  lineHeight?: number;
}) {
  const list = typeof lines === 'string' ? [lines] : lines;
  return (
    <text data-label x={x} y={y} textAnchor={anchor} fontWeight={weight} fill={fill} stroke="none">
      {list.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/** A leader line: a dot on the part, then a thin polyline to the label. */
export function Leader({ points }: { points: readonly (readonly [number, number])[] }) {
  const [first] = points;
  return (
    <g data-label>
      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke={LINE}
        strokeWidth={SW}
      />
      {first ? <circle cx={first[0]} cy={first[1]} r={4} fill={INK} stroke="none" /> : null}
    </g>
  );
}

/** A small filled arrow head pointing in `dir` with its tip at (x, y). */
export function ArrowHead({
  x,
  y,
  dir,
  fill = INK,
  size = 9,
}: {
  x: number;
  y: number;
  dir: 'up' | 'down' | 'left' | 'right';
  fill?: string;
  size?: number;
}) {
  const s = size;
  const h = s * 0.6;
  const pts: Record<typeof dir, string> = {
    right: `${x},${y} ${x - s},${y - h} ${x - s},${y + h}`,
    left: `${x},${y} ${x + s},${y - h} ${x + s},${y + h}`,
    down: `${x},${y} ${x - h},${y - s} ${x + h},${y - s}`,
    up: `${x},${y} ${x - h},${y + s} ${x + h},${y + s}`,
  };
  return <polygon points={pts[dir]} fill={fill} stroke="none" />;
}

/** `list[i]`, for geometry tables whose indexes are known to exist. */
export function pick<T>(list: readonly T[], i: number): T {
  const value = list[i];
  if (value === undefined) throw new RangeError(`diagram: no item at index ${i}`);
  return value;
}
