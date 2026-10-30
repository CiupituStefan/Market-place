import {
  ACCENT,
  DiagramSvg,
  FILL_2,
  INK,
  LINE,
  Label,
  SW,
  SW_STRONG,
  type DiagramProps,
} from './parts';

/**
 * Four keycap cross-sections, one per way of putting a legend on a keycap. The legend is always
 * blue; the keycap plastic is grey.
 */

type Method = 'pad' | 'laser' | 'dye' | 'double';

const LABELS: Record<'en' | 'ro', Record<Method, { name: string; lines: string[] }>> = {
  en: {
    pad: { name: 'Pad printing', lines: ['ink as a thin layer', 'on top of the surface'] },
    laser: { name: 'Laser etching', lines: ['top coat removed,', 'plastic below exposed'] },
    dye: {
      name: 'Dye-sublimation',
      lines: ['ink diffused into the', 'top of the plastic; only', 'darker than the keycap'],
    },
    double: {
      name: 'Double-shot',
      lines: ['two plastic shots: the', 'legend is its own piece', 'through the keycap'],
    },
  },
  ro: {
    pad: { name: 'Tampografie', lines: ['cerneală într-un strat', 'subțire, deasupra'] },
    laser: {
      name: 'Gravare laser',
      lines: ['stratul de suprafață e', 'îndepărtat, apare', 'plasticul de dedesubt'],
    },
    dye: {
      name: 'Sublimare',
      lines: ['cerneala pătrunde în', 'plasticul de la suprafață;', 'doar mai închisă ca tasta'],
    },
    double: {
      name: 'Dublă injecție',
      lines: ['două injecții de plastic:', 'legenda e o piesă separată', 'ce trece prin tastă'],
    },
  },
};

const ORDER: readonly Method[] = ['pad', 'laser', 'dye', 'double'];
const CELL_W = 320;
const CELL_H = 268;
const CAP_HALF = 110;
/** Top of the keycap within a cell. */
const CAP_TOP = 40;
const CAP_H = 96;
const TOP_THICK = 22;
const WALL = 16;
const LEGEND_HALF = 32;

function Keycap({ cx, y }: { cx: number; y: number }) {
  const d = `M${cx - CAP_HALF} ${y + CAP_H} L${cx - CAP_HALF + 10} ${y} H${cx + CAP_HALF - 10} L${cx + CAP_HALF} ${y + CAP_H} H${cx + CAP_HALF - WALL} L${cx + CAP_HALF - 10 - WALL + 4} ${y + TOP_THICK} H${cx - CAP_HALF + 10 + WALL - 4} L${cx - CAP_HALF + WALL} ${y + CAP_H} Z`;
  return (
    <g data-part="keycap">
      <path d={d} fill={FILL_2} stroke={INK} strokeWidth={SW} />
      {/* stem socket */}
      <rect
        x={cx - 16}
        y={y + TOP_THICK}
        width={32}
        height={CAP_H - TOP_THICK - 8}
        fill={FILL_2}
        stroke={INK}
        strokeWidth={SW}
      />
      <line
        x1={cx}
        y1={y + TOP_THICK + 10}
        x2={cx}
        y2={y + CAP_H - 18}
        stroke={LINE}
        strokeWidth={SW}
      />
    </g>
  );
}

function Legend({ method, cx, y }: { method: Method; cx: number; y: number }) {
  const lx = cx - LEGEND_HALF;
  const lw = LEGEND_HALF * 2;
  switch (method) {
    case 'pad':
      return (
        <rect
          x={lx}
          y={y - 7}
          width={lw}
          height={7}
          rx={2}
          fill={ACCENT}
          stroke={INK}
          strokeWidth={SW}
        />
      );
    case 'laser': {
      const coat = 8;
      const left = cx - CAP_HALF + 10;
      const right = cx + CAP_HALF - 10;
      return (
        <g>
          <rect x={left} y={y} width={lx - left} height={coat} fill={LINE} stroke="none" />
          <rect x={lx + lw} y={y} width={right - lx - lw} height={coat} fill={LINE} stroke="none" />
          <line
            x1={lx + 3}
            y1={y + coat}
            x2={lx + lw - 3}
            y2={y + coat}
            stroke={ACCENT}
            strokeWidth={SW_STRONG + 1}
          />
          <path
            d={`M${left} ${y} H${lx} V${y + coat} H${lx + lw} V${y} H${right}`}
            fill="none"
            stroke={INK}
            strokeWidth={SW}
          />
        </g>
      );
    }
    case 'dye':
      return (
        <rect
          x={lx}
          y={y + 1}
          width={lw}
          height={11}
          fill={ACCENT}
          fillOpacity={0.6}
          stroke={ACCENT}
          strokeWidth={SW}
          strokeDasharray="3 4"
        />
      );
    case 'double': {
      const inner = TOP_THICK;
      const d = `M${lx + 8} ${y} H${lx + lw - 8} V${y + inner - 8} H${cx + CAP_HALF - 34} V${y + inner + 2} H${cx - CAP_HALF + 34} V${y + inner - 8} H${lx + 8} Z`;
      return <path d={d} fill={ACCENT} stroke={INK} strokeWidth={SW} />;
    }
  }
}

export function LegendMethods({ locale, className, title }: DiagramProps) {
  const t = LABELS[locale];
  return (
    <DiagramSvg id="legend-methods" title={title} className={className} height={CELL_H * 2}>
      <line
        x1={CELL_W}
        y1={16}
        x2={CELL_W}
        y2={CELL_H * 2 - 16}
        stroke={LINE}
        strokeWidth={SW}
        opacity={0.35}
      />
      <line
        x1={16}
        y1={CELL_H}
        x2={624}
        y2={CELL_H}
        stroke={LINE}
        strokeWidth={SW}
        opacity={0.35}
      />
      {ORDER.map((m, i) => {
        const ox = (i % 2) * CELL_W;
        const oy = Math.floor(i / 2) * CELL_H;
        const cx = ox + CELL_W / 2;
        const y = oy + CAP_TOP;
        return (
          <g key={m} data-part="method" data-method={m}>
            <Keycap cx={cx} y={y} />
            <g data-part="legend">
              <Legend method={m} cx={cx} y={y} />
            </g>
            <Label x={ox + 24} y={y + CAP_H + 40} lines={t[m].name} weight={600} />
            <Label x={ox + 24} y={y + CAP_H + 68} lines={t[m].lines} fill={LINE} />
          </g>
        );
      })}
    </DiagramSvg>
  );
}
