import {
  ACCENT,
  ArrowHead,
  DiagramSvg,
  INK,
  LINE,
  Label,
  Leader,
  SW,
  SW_STRONG,
  pick,
  type DiagramProps,
} from './parts';

/**
 * A 4 × 5 corner of a col2row key matrix: each switch is in series with a diode pointing from
 * its column to its row. The firmware drives one column HIGH at a time and reads the rows.
 */

const LABELS = {
  en: {
    high: 'column → HIGH',
    read: ['rows', 'read'],
    diode: 'diode prevents ghosting',
    pins: '6 rows × 14 columns = 20 pins',
  },
  ro: {
    high: 'coloană → HIGH',
    read: ['rânduri', 'citite'],
    diode: 'dioda previne ghosting-ul',
    pins: '6 rânduri × 14 coloane = 20 de pini',
  },
} as const;

const COLS = [110, 195, 280, 365, 450];
const ROWS = [154, 244, 334, 424];
const ACTIVE = 1;
const ROW_START = 60;
const ROW_END = 516;
const COL_TOP = 92;
/** Offset of the switch–diode branch above its row. */
const BRANCH = 46;
const DIODE_DX = 46;

function Cell({ cx, ry, active }: { cx: number; ry: number; active: boolean }) {
  const y = ry - BRANCH;
  const dx = cx + DIODE_DX;
  const sw = active ? ACCENT : INK;
  return (
    <g>
      <g data-part="switch" stroke={sw} strokeWidth={SW} fill="none">
        <line x1={cx} y1={y} x2={cx + 10} y2={y} />
        <circle cx={cx + 13} cy={y} r={3} fill={sw} stroke="none" />
        <line x1={cx + 13} y1={y} x2={cx + 31} y2={y - 11} />
        <circle cx={cx + 33} cy={y} r={3} fill={sw} stroke="none" />
        <line x1={cx + 36} y1={y} x2={dx} y2={y} />
        <line x1={dx} y1={y} x2={dx} y2={y + 8} />
      </g>
      <g data-part="diode">
        <polygon
          points={`${dx - 8},${y + 8} ${dx + 8},${y + 8} ${dx},${y + 22}`}
          fill={INK}
          stroke={INK}
          strokeWidth={SW}
        />
        <line
          x1={dx - 8}
          y1={y + 22}
          x2={dx + 8}
          y2={y + 22}
          stroke={INK}
          strokeWidth={SW_STRONG}
        />
        <line x1={dx} y1={y + 22} x2={dx} y2={ry} stroke={INK} strokeWidth={SW} />
        <circle cx={dx} cy={ry} r={3.5} fill={INK} stroke="none" />
      </g>
      <circle cx={cx} cy={y} r={3.5} fill={sw} stroke="none" />
    </g>
  );
}

export function MatrixScan({ locale, className, title }: DiagramProps) {
  const t = LABELS[locale];
  const lastRow = pick(ROWS, ROWS.length - 1);
  const diodeX = pick(COLS, 3) + DIODE_DX;
  return (
    <DiagramSvg id="matrix-scan" title={title} className={className} height={566}>
      {/* rows: read by the controller */}
      {ROWS.map((ry, r) => (
        <g key={ry} data-part="row">
          <Label x={24} y={ry + 7} lines={`R${r}`} weight={600} fill={LINE} />
          <line x1={ROW_START} y1={ry} x2={ROW_END - 6} y2={ry} stroke={INK} strokeWidth={SW} />
          <ArrowHead x={ROW_END + 4} y={ry} dir="right" />
        </g>
      ))}
      <g data-part="read">
        <path
          d={`M${ROW_END + 14} ${ROWS[0]} H${ROW_END + 22} V${lastRow} H${ROW_END + 14}`}
          fill="none"
          stroke={LINE}
          strokeWidth={SW}
        />
        <Label x={ROW_END + 32} y={(pick(ROWS, 0) + lastRow) / 2 - 6} lines={t.read} weight={600} />
      </g>

      {COLS.map((cx, c) => {
        const active = c === ACTIVE;
        return (
          <g key={cx} data-part="column" data-column={c} data-active={active ? 'true' : undefined}>
            <Label
              x={cx}
              y={COL_TOP - 14}
              lines={`C${c}`}
              anchor="middle"
              weight={600}
              fill={active ? ACCENT : LINE}
            />
            <line
              x1={cx}
              y1={COL_TOP}
              x2={cx}
              y2={lastRow - BRANCH}
              stroke={active ? ACCENT : INK}
              strokeWidth={active ? SW_STRONG + 1 : SW}
            />
            {ROWS.map((ry) => (
              <Cell key={ry} cx={cx} ry={ry} active={active} />
            ))}
          </g>
        );
      })}

      <g data-part="drive">
        <Label
          x={pick(COLS, ACTIVE)}
          y={30}
          lines={t.high}
          anchor="middle"
          weight={600}
          fill={ACCENT}
        />
        <line
          x1={pick(COLS, ACTIVE)}
          y1={40}
          x2={pick(COLS, ACTIVE)}
          y2={52}
          stroke={ACCENT}
          strokeWidth={SW_STRONG}
        />
        <ArrowHead x={pick(COLS, ACTIVE)} y={60} dir="down" fill={ACCENT} />
      </g>

      <g data-part="ghosting">
        <Leader
          points={[
            [diodeX + 9, lastRow - BRANCH + 15],
            [diodeX + 32, lastRow - BRANCH + 15],
            [diodeX + 32, lastRow + 34],
          ]}
        />
        <Label x={diodeX + 32} y={lastRow + 58} lines={t.diode} anchor="middle" />
      </g>

      <Label x={24} y={548} lines={t.pins} weight={600} fill={LINE} />
    </DiagramSvg>
  );
}
