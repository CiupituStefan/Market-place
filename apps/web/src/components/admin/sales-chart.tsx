'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ChartPoint {
  date: string;
  value: number;
}

const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 56 };
const MAX_BAR = 24;

/** 0, 1, 2, 2.5, 5 × 10^n steps: clean round ticks. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * magnitude >= raw) ?? 10) * magnitude;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  const last = ticks[ticks.length - 1] ?? 0;
  if (last < max) ticks.push(last + step);
  return ticks;
}

const shortDate = new Intl.DateTimeFormat('en-IE', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const longDate = new Intl.DateTimeFormat('en-IE', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const dateOf = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Bar with a 4px rounded data end and a square baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Single-series column chart (one measure, one axis): the title names the series,
 * so there is no legend. Each column is its own hover/focus target; a table view
 * carries every value without hovering.
 */
export function ColumnChart({
  title,
  points,
  format,
  axisFormat = format,
  stale,
}: {
  title: string;
  points: ChartPoint[];
  format: (value: number) => string;
  axisFormat?: (value: number) => string;
  /** Refetching: keep the frame, dim it. */
  stale?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  const ticks = niceTicks(Math.max(0, ...points.map((p) => p.value)));
  const top = Math.max(ticks[ticks.length - 1] ?? 0, 1);
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / Math.max(points.length, 1);
  const barW = Math.max(2, Math.min(MAX_BAR, band - 2));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const labelEvery = Math.ceil(points.length / Math.max(2, Math.floor(plotW / 70)));
  const hovered = active === null ? null : points[active];

  return (
    <figure className="grid gap-3">
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-semibold">{title}</span>
        <button
          type="button"
          onClick={() => {
            setTable((t) => !t);
          }}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {table ? 'Show chart' : 'Show table'}
        </button>
      </figcaption>
      {table ? (
        <div className="max-h-72 overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-xs text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Date
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {title}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date} className="border-t">
                  <td className="px-3 py-1.5">{longDate.format(dateOf(p.date))}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{format(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={ref}
          className={cn('relative transition-opacity', stale && 'opacity-60')}
          onPointerLeave={() => {
            setActive(null);
          }}
        >
          <svg
            width={width}
            height={HEIGHT}
            role="group"
            aria-label={`${title}, ${String(points.length)} days`}
            className="block max-w-full overflow-visible"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  className="stroke-chart-grid"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={PAD.left - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground text-[11px] tabular-nums"
                >
                  {axisFormat(t)}
                </text>
              </g>
            ))}
            {points.map((p, i) => {
              const x = PAD.left + i * band + (band - barW) / 2;
              const h = Math.max(0, y(0) - y(p.value));
              return (
                <g
                  key={p.date}
                  tabIndex={0}
                  role="img"
                  aria-label={`${longDate.format(dateOf(p.date))}: ${format(p.value)}`}
                  onPointerEnter={() => {
                    setActive(i);
                  }}
                  onFocus={() => {
                    setActive(i);
                  }}
                  onBlur={() => {
                    setActive(null);
                  }}
                  className="outline-none"
                >
                  {/* Hit target: the whole band, taller than the mark. */}
                  <rect
                    x={PAD.left + i * band}
                    y={PAD.top}
                    width={band}
                    height={plotH}
                    fill="transparent"
                  />
                  {h > 0 && (
                    <path
                      d={columnPath(x, y(p.value), barW, h)}
                      className={cn(
                        'fill-chart-1 transition-opacity',
                        active !== null && active !== i && 'opacity-55',
                      )}
                    />
                  )}
                  {i % labelEvery === 0 && (
                    <text
                      x={x + barW / 2}
                      y={HEIGHT - 8}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[11px]"
                    >
                      {shortDate.format(dateOf(p.date))}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          {hovered && active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-0 z-10 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg"
              style={{
                left: Math.min(
                  Math.max(PAD.left + active * band + band / 2 - 70, 0),
                  Math.max(0, width - 150),
                ),
              }}
            >
              <p className="text-sm font-semibold tabular-nums">{format(hovered.value)}</p>
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="inline-block h-0.5 w-3 rounded-full bg-chart-1"
                  aria-hidden="true"
                />
                {longDate.format(dateOf(hovered.date))}
              </p>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

/** Horizontal bars for a ranked list (best sellers); values are labelled at the tip. */
export function RankedBars({
  rows,
  format,
}: {
  rows: { key: string; label: string; detail?: string; value: number; display: string }[];
  format?: (value: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="grid gap-3">
      {rows.map((row) => (
        <li key={row.key} className="grid gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{row.label}</span>
            <span className="shrink-0 tabular-nums">{row.display}</span>
          </div>
          <div className="flex items-center gap-2" title={format ? format(row.value) : row.display}>
            <span
              className="h-2 min-w-1 rounded-r-[4px] bg-chart-1"
              style={{ width: `${String((row.value / max) * 100)}%` }}
              aria-hidden="true"
            />
          </div>
          {row.detail && <span className="text-xs text-muted-foreground">{row.detail}</span>}
        </li>
      ))}
    </ol>
  );
}
