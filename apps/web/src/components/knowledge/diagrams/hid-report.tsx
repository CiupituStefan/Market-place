import {
  ACCENT,
  ACCENT_2,
  DiagramSvg,
  FILL,
  FILL_2,
  INK,
  LINE,
  Label,
  Leader,
  SW,
  pick,
  type DiagramProps,
} from './parts';

/**
 * The 8-byte keyboard report: byte 0 is a bitmap of the modifier keys, byte 1 is reserved and
 * bytes 2–7 carry the codes of up to six pressed keys.
 */

const LABELS = {
  en: {
    heading: 'Byte 0 · modifier bitmap',
    left: 'left',
    right: 'right',
    modifiers: 'modifiers',
    reserved: 'reserved',
    keys: 'key codes (up to 6 keys)',
  },
  ro: {
    heading: 'Octetul 0 · bitmap modificatori',
    left: 'stânga',
    right: 'dreapta',
    modifiers: 'modificatori',
    reserved: 'rezervat',
    keys: 'coduri de taste (max. 6 taste)',
  },
} as const;

const MODS = ['Ctrl', 'Shift', 'Alt', 'GUI'] as const;
const X0 = 12;
const SPAN = 616;
const BIT_W = SPAN / 8;
const BIT_Y = 76;
const BIT_H = 40;
const BOX_W = 70;
const BOX_GAP = (SPAN - 8 * BOX_W) / 7;
const BOX_Y = 186;
const BOX_H = 60;

const boxX = (i: number) => X0 + i * (BOX_W + BOX_GAP);

export function HidReport({ locale, className, title }: DiagramProps) {
  const t = LABELS[locale];
  const keysLeft = boxX(2);
  const keysRight = boxX(7) + BOX_W;
  const below = BOX_Y + BOX_H;
  return (
    <DiagramSvg id="hid-report" title={title} className={className} height={364}>
      <g data-part="bitmap">
        <Label x={X0} y={24} lines={t.heading} weight={600} />
        {[t.left, t.right].map((side, s) => {
          const x1 = X0 + s * 4 * BIT_W + 4;
          const x2 = X0 + (s + 1) * 4 * BIT_W - 4;
          return (
            <g key={side}>
              <path
                d={`M${x1} ${BIT_Y - 6} V${BIT_Y - 12} H${x2} V${BIT_Y - 6}`}
                fill="none"
                stroke={LINE}
                strokeWidth={SW}
              />
              <Label x={(x1 + x2) / 2} y={BIT_Y - 20} lines={side} anchor="middle" fill={LINE} />
            </g>
          );
        })}
        {Array.from({ length: 8 }, (_, i) => (
          <g key={i} data-part="bit">
            <rect
              x={X0 + i * BIT_W}
              y={BIT_Y}
              width={BIT_W}
              height={BIT_H}
              fill={FILL_2}
              stroke={INK}
              strokeWidth={SW}
            />
            <Label
              x={X0 + i * BIT_W + BIT_W / 2}
              y={BIT_Y + 27}
              lines={pick(MODS, i % 4)}
              anchor="middle"
            />
          </g>
        ))}
        {/* zoom lines from the bitmap down to byte 0 */}
        <g stroke={LINE} strokeWidth={SW} strokeDasharray="4 6">
          <line x1={X0} y1={BIT_Y + BIT_H} x2={boxX(0)} y2={BOX_Y} />
          <line x1={X0 + SPAN} y1={BIT_Y + BIT_H} x2={boxX(0) + BOX_W} y2={BOX_Y} />
        </g>
      </g>

      {Array.from({ length: 8 }, (_, i) => {
        const fill = i === 0 ? ACCENT_2 : i === 1 ? FILL : ACCENT;
        return (
          <g key={i} data-part="byte" data-byte={i}>
            <rect
              x={boxX(i)}
              y={BOX_Y}
              width={BOX_W}
              height={BOX_H}
              rx={4}
              fill={fill}
              stroke={INK}
              strokeWidth={SW}
              strokeDasharray={i === 1 ? '6 5' : undefined}
            />
            <Label
              x={boxX(i) + BOX_W / 2}
              y={BOX_Y + BOX_H / 2 + 8}
              lines={String(i)}
              anchor="middle"
              weight={600}
              fill={i === 1 ? LINE : FILL}
            />
          </g>
        );
      })}

      <g data-part="meaning">
        <path
          d={`M${keysLeft + 2} ${below + 10} V${below + 18} H${keysRight - 2} V${below + 10}`}
          fill="none"
          stroke={LINE}
          strokeWidth={SW}
        />
        <Label x={(keysLeft + keysRight) / 2} y={below + 46} lines={t.keys} anchor="middle" />
        <Leader
          points={[
            [boxX(1) + BOX_W / 2, below + 8],
            [boxX(1) + BOX_W / 2, below + 58],
            [boxX(1) + BOX_W / 2 + 10, below + 58],
          ]}
        />
        <Label x={boxX(1) + BOX_W / 2 + 16} y={below + 65} lines={t.reserved} fill={INK} />
        <Leader
          points={[
            [boxX(0) + BOX_W / 2, below + 8],
            [boxX(0) + BOX_W / 2, below + 98],
            [boxX(0) + BOX_W / 2 + 10, below + 98],
          ]}
        />
        <Label x={boxX(0) + BOX_W / 2 + 16} y={below + 105} lines={t.modifiers} />
      </g>
    </DiagramSvg>
  );
}
