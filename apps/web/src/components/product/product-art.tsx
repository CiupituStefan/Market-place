import { useId } from 'react';
import type { ProductPreview } from '@/lib/catalog/schemas';
import { cn } from '@/lib/utils';
import { darken, lighten, luminance, mix } from './color';
import { layoutKeys, type KeyRect } from './layouts';

/**
 * Procedurally rendered product imagery (inline SVG): crisp at any size, zero
 * network cost, and reused by the configurator to preview combinations.
 * Real photography from S3/CloudFront replaces it where a product has images.
 */

export type ArtView = 'front' | 'detail';

interface ProductArtProps {
  preview: ProductPreview;
  view?: ArtView;
  /**
   * `lite` drops legends and highlights: roughly half the markup, used for grids
   * where the art is small. `full` is for hero and gallery renders.
   */
  quality?: 'lite' | 'full';
  className?: string;
  title: string;
}

const U = 20; // px per key unit in SVG space

/** An empty title marks the art as decorative (e.g. next to a visible label). */
function a11y(title: string) {
  return title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true };
}

export function ProductArt({
  preview,
  view = 'front',
  quality = 'lite',
  className,
  title,
}: ProductArtProps) {
  const id = useId().replace(/:/g, '');
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {renderArt(preview, view, quality === 'full', id, title)}
    </div>
  );
}

function renderArt(
  preview: ProductPreview,
  view: ArtView,
  full: boolean,
  id: string,
  title: string,
) {
  switch (preview.kind) {
    case 'keyboard':
      return <KeyboardSvg preview={preview} view={view} full={full} id={id} title={title} />;
    case 'switch':
      return <SwitchSvg preview={preview} id={id} title={title} />;
    case 'keycaps':
      return <KeycapsSvg preview={preview} full={full} id={id} title={title} />;
    case 'stabilizer':
      return <StabilizerSvg preview={preview} id={id} title={title} />;
    case 'cable':
      return <CableSvg preview={preview} id={id} title={title} />;
    case 'deskmat':
      return <DeskmatSvg preview={preview} id={id} title={title} />;
    case 'wristrest':
      return <WristrestSvg preview={preview} id={id} title={title} />;
  }
}

interface SvgProps {
  preview: ProductPreview;
  id: string;
  title: string;
}

function keyFill(role: KeyRect['role'], p: ProductPreview): string {
  const darkKeys = luminance(p.keyColor) < 0.2;
  switch (role) {
    case 'accent':
      return p.accentColor;
    case 'mod':
    case 'space':
      return darkKeys ? lighten(p.keyColor, 0.08) : mix(p.keyColor, p.caseColor, 0.35);
    case 'alpha':
      return p.keyColor;
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Compact rectangle segment inset by `r`. Painted with a round-joined stroke of
 * width 2r in the same color, it renders as a rounded rectangle of the full size
 * at a fraction of the markup of arc commands.
 */
function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  return `M${r1(x + r)} ${r1(y + r)}h${r1(w - 2 * r)}v${r1(h - 2 * r)}h${r1(-(w - 2 * r))}z`;
}

function RoundedPath({
  d,
  fill,
  radius,
  opacity,
}: {
  d: string;
  fill: string;
  radius: number;
  opacity?: number;
}) {
  return (
    <path
      d={d}
      fill={fill}
      stroke={fill}
      strokeWidth={radius * 2}
      strokeLinejoin="round"
      opacity={opacity}
    />
  );
}

/**
 * Renders all keycaps as a handful of <path> elements grouped by color instead
 * of several elements per key: ~10x less markup in the HTML and RSC payload.
 */
function Keycaps({ keys, p, full }: { keys: KeyRect[]; p: ProductPreview; full: boolean }) {
  const layers = new Map<string, { base: string[]; top: string[] }>();
  const legends = new Map<string, string[]>();
  const gloss: string[] = [];
  for (const k of keys) {
    const fill = keyFill(k.role, p);
    const x = k.x * U + 1;
    const y = k.y * U + 1;
    const w = k.w * U - 2;
    const h = U - 2;
    const layer = layers.get(fill) ?? { base: [], top: [] };
    layer.base.push(roundedRect(x, y, w, h, 3));
    layer.top.push(roundedRect(x + 2, y + 1.2, w - 4, h - 4.6, 2.4));
    layers.set(fill, layer);
    if (full) {
      gloss.push(roundedRect(x + 2, y + 1.2, w - 4, (h - 4.6) / 2, 2.4));
      if (k.role !== 'space') {
        const color = k.role === 'accent' ? lighten(p.accentColor, 0.6) : p.legendColor;
        const list = legends.get(color) ?? [];
        list.push(roundedRect(x + 4.5, y + 4, k.role === 'alpha' ? 3.2 : 5, 1.6, 0.8));
        legends.set(color, list);
      }
    }
  }
  return (
    <g>
      {[...layers].map(([fill, layer]) => (
        <RoundedPath
          key={`b${fill}`}
          d={layer.base.join('')}
          fill={darken(fill, 0.22)}
          radius={3}
        />
      ))}
      {[...layers].map(([fill, layer]) => (
        <RoundedPath key={`t${fill}`} d={layer.top.join('')} fill={fill} radius={2.4} />
      ))}
      {gloss.length > 0 && (
        <RoundedPath d={gloss.join('')} fill="#ffffff" radius={2.4} opacity={0.06} />
      )}
      {[...legends].map(([color, list]) => (
        <RoundedPath key={`l${color}`} d={list.join('')} fill={color} radius={0.8} opacity={0.75} />
      ))}
    </g>
  );
}

function KeyboardSvg({
  preview,
  view,
  full,
  id,
  title,
}: SvgProps & { view: ArtView; full: boolean }) {
  const { keys, width, height } = layoutKeys(preview.layout ?? '75%');
  const pad = 0.7 * U;
  const w = width * U + pad * 2;
  const h = height * U + pad * 2;
  const shadowY = h + 14;
  // Detail view crops to the top-left corner (Esc, F-row, accent keys).
  const viewBox =
    view === 'detail' ? `${-6} ${-6} ${w * 0.42} ${h * 0.62}` : `-16 -10 ${w + 32} ${h + 44}`;
  return (
    <svg viewBox={viewBox} {...a11y(title)} className="h-auto w-full drop-shadow-sm">
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`case-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lighten(preview.caseColor, 0.12)} />
          <stop offset="1" stopColor={darken(preview.caseColor, 0.12)} />
        </linearGradient>
        <radialGradient id={`shadow-${id}`}>
          <stop offset="0" stopColor="#000" stopOpacity="0.28" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      {view === 'front' && (
        <ellipse cx={w / 2} cy={shadowY} rx={w * 0.52} ry={10} fill={`url(#shadow-${id})`} />
      )}
      <rect x={0} y={0} width={w} height={h} rx={14} fill={`url(#case-${id})`} />
      <rect
        x={3}
        y={3}
        width={w - 6}
        height={h - 6}
        rx={11}
        fill="none"
        stroke="#ffffff"
        strokeOpacity={0.12}
      />
      <rect
        x={pad - 3}
        y={pad - 3}
        width={width * U + 6}
        height={height * U + 6}
        rx={6}
        fill={darken(preview.caseColor, 0.35)}
      />
      <g transform={`translate(${pad} ${pad})`}>
        <Keycaps keys={keys} p={preview} full={full} />
      </g>
      <rect
        x={w / 2 - 18}
        y={1.5}
        width={36}
        height={2}
        rx={1}
        fill={preview.accentColor}
        opacity={0.9}
      />
    </svg>
  );
}

function SwitchSvg({ preview, id, title }: SvgProps) {
  const housing = preview.caseColor;
  const top = preview.keyColor;
  return (
    <svg viewBox="0 0 200 200" {...a11y(title)} className="h-auto w-full">
      {title && <title>{title}</title>}
      <defs>
        <radialGradient id={`s-${id}`}>
          <stop offset="0" stopColor="#000" stopOpacity="0.25" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="168" rx="62" ry="9" fill={`url(#s-${id})`} />
      {/* pins */}
      <rect x="82" y="150" width="4" height="14" rx="1" fill="#c9a24a" />
      <rect x="112" y="150" width="4" height="12" rx="1" fill="#c9a24a" />
      {/* bottom housing */}
      <path d="M48 112 h104 l-6 42 h-92 z" fill={darken(housing, 0.05)} />
      <path d="M48 112 h104 l-2 8 h-100 z" fill={lighten(housing, 0.15)} />
      {/* top housing (translucent) */}
      <path d="M56 78 h88 l8 34 h-104 z" fill={top} opacity={0.88} />
      <path d="M62 78 h76 l3 10 h-82 z" fill="#fff" opacity={0.25} />
      {/* stem */}
      <rect x="92" y="40" width="16" height="40" rx="2" fill={preview.accentColor} />
      <rect x="80" y="54" width="40" height="10" rx="2" fill={preview.accentColor} />
      <rect x="92" y="40" width="5" height="40" rx="2" fill="#fff" opacity={0.25} />
    </svg>
  );
}

function KeycapsSvg({ preview, full, id, title }: SvgProps & { full: boolean }) {
  const cols = 6;
  const rows = 4;
  const keys: KeyRect[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const role: KeyRect['role'] =
        (r === 0 && c === 0) || (r === 2 && c === 5)
          ? 'accent'
          : c === 0 || r === 3
            ? 'mod'
            : 'alpha';
      keys.push({ x: c + (r % 2) * 0.25, y: r, w: 1, role });
    }
  }
  return (
    <svg
      viewBox={`-10 -10 ${cols * U + 26} ${rows * U + 34}`}
      {...a11y(title)}
      className="h-auto w-full"
    >
      {title && <title>{title}</title>}
      <defs>
        <radialGradient id={`k-${id}`}>
          <stop offset="0" stopColor="#000" stopOpacity="0.22" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse
        cx={(cols * U) / 2 + 3}
        cy={rows * U + 12}
        rx={cols * U * 0.55}
        ry={6}
        fill={`url(#k-${id})`}
      />
      <Keycaps keys={keys} p={preview} full={full} />
    </svg>
  );
}

function StabilizerSvg({ preview, title }: SvgProps) {
  return (
    <svg viewBox="0 0 240 140" {...a11y(title)} className="h-auto w-full">
      {title && <title>{title}</title>}
      <path
        d="M40 92 v-22 h160 v22"
        fill="none"
        stroke="#c9a24a"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {[24, 176].map((x) => (
        <g key={x}>
          <rect x={x} y={44} width={40} height={60} rx={6} fill={preview.caseColor} />
          <rect x={x + 12} y={30} width={16} height={30} rx={3} fill={preview.keyColor} />
          <rect x={x + 4} y={48} width={32} height={6} rx={2} fill="#fff" opacity={0.12} />
        </g>
      ))}
    </svg>
  );
}

function CableSvg({ preview, title }: SvgProps) {
  const coils = Array.from({ length: 9 }, (_, i) => 70 + i * 12);
  return (
    <svg viewBox="0 0 260 160" {...a11y(title)} className="h-auto w-full">
      {title && <title>{title}</title>}
      <path
        d="M14 120 C 40 120, 50 90, 70 90"
        fill="none"
        stroke={preview.caseColor}
        strokeWidth="7"
        strokeLinecap="round"
      />
      {coils.map((x) => (
        <ellipse
          key={x}
          cx={x}
          cy={90}
          rx={7}
          ry={18}
          fill="none"
          stroke={preview.caseColor}
          strokeWidth="6"
        />
      ))}
      <path
        d="M176 90 C 196 90, 200 60, 222 60"
        fill="none"
        stroke={preview.caseColor}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <rect x={196} y={50} width={30} height={20} rx={5} fill={preview.accentColor} />
      <rect x={224} y={54} width={22} height={12} rx={3} fill="#b8bbc0" />
      <rect x={4} y={112} width={16} height={16} rx={3} fill="#b8bbc0" />
    </svg>
  );
}

function DeskmatSvg({ preview, title }: SvgProps) {
  const lines = Array.from({ length: 7 }, (_, i) => i);
  return (
    <svg viewBox="0 0 300 140" {...a11y(title)} className="h-auto w-full">
      {title && <title>{title}</title>}
      <rect x="6" y="6" width="288" height="128" rx="14" fill={preview.caseColor} />
      <g fill="none" stroke={darken(preview.caseColor, 0.18)} strokeWidth="1.4" opacity={0.7}>
        {lines.map((i) => (
          <path
            key={i}
            d={`M ${20 + i * 6} 120 C ${80 + i * 10} ${40 - i * 4}, ${170 - i * 6} ${150 - i * 8}, ${280 - i * 6} ${30 + i * 8}`}
          />
        ))}
      </g>
      <rect
        x="6"
        y="6"
        width="288"
        height="128"
        rx="14"
        fill="none"
        stroke={darken(preview.caseColor, 0.3)}
        strokeWidth="3"
        strokeDasharray="1 3"
      />
      <text
        x="268"
        y="122"
        textAnchor="end"
        fontFamily="monospace"
        fontSize="9"
        fill={preview.legendColor}
        opacity="0.7"
      >
        CSE
      </text>
    </svg>
  );
}

function WristrestSvg({ title }: SvgProps) {
  const wood = '#6b4429';
  return (
    <svg viewBox="0 0 300 110" {...a11y(title)} className="h-auto w-full">
      {title && <title>{title}</title>}
      <ellipse cx="150" cy="92" rx="140" ry="8" fill="#000" opacity="0.15" />
      <rect x="12" y="30" width="276" height="56" rx="16" fill={wood} />
      <rect x="12" y="30" width="276" height="20" rx="10" fill={lighten(wood, 0.15)} />
      <g fill="none" stroke={darken(wood, 0.25)} strokeWidth="1" opacity={0.6}>
        <path d="M30 60 C 90 50, 140 72, 270 58" />
        <path d="M30 70 C 100 62, 160 82, 270 70" />
        <path d="M40 46 C 110 40, 170 56, 260 44" />
      </g>
    </svg>
  );
}
