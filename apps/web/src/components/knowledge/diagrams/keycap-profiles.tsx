import {
  ACCENT,
  ACCENT_2,
  DiagramSvg,
  FILL_2,
  INK,
  LINE,
  Label,
  SW,
  pick,
  type DiagramProps,
} from './parts';

/**
 * Side silhouettes of one key per row (R1–R4) for five profiles. Heights are relative only:
 * sculpted profiles change height and angle per row, uniform ones are identical on every row.
 */

const LABELS = {
  en: {
    sculpted: 'Sculpted: height and angle change per row',
    uniform: 'Uniform: the same key on every row',
    cylindrical: 'cylindrical',
    spherical: 'spherical',
  },
  ro: {
    sculpted: 'Sculptate: înălțimea și unghiul diferă',
    uniform: 'Uniforme: aceeași tastă pe orice rând',
    cylindrical: 'cilindric',
    spherical: 'sferic',
  },
} as const;

interface Profile {
  name: string;
  top: 'cylindrical' | 'spherical';
  /** Height per row R1–R4, in viewBox units. */
  heights: readonly [number, number, number, number];
  /** Half width of the top surface. */
  topHalf: number;
  sculpted: boolean;
}

const PROFILES: readonly Profile[] = [
  { name: 'OEM', top: 'cylindrical', heights: [64, 54, 50, 53], topHalf: 26, sculpted: true },
  { name: 'Cherry', top: 'cylindrical', heights: [54, 45, 41, 44], topHalf: 26, sculpted: true },
  { name: 'SA', top: 'spherical', heights: [80, 70, 66, 70], topHalf: 22, sculpted: true },
  { name: 'DSA', top: 'spherical', heights: [44, 44, 44, 44], topHalf: 24, sculpted: false },
  { name: 'XDA', top: 'spherical', heights: [50, 50, 50, 50], topHalf: 31, sculpted: false },
];

/** Tilt of the top per row on sculpted profiles (back edge minus front edge). */
const TILT = [12, 6, 0, -8] as const;
const COLUMNS = [264, 356, 448, 540];
const BASE_HALF = 37;
const LABEL_X = 16;

function keyPath(x: number, base: number, h: number, tilt: number, topHalf: number, depth: number) {
  const front = base - (h - tilt / 2);
  const back = base - (h + tilt / 2);
  const mid = (front + back) / 2 + depth;
  return `M${x - BASE_HALF} ${base} L${x - topHalf} ${front} Q${x} ${mid + depth} ${x + topHalf} ${back} L${x + BASE_HALF} ${base} Z`;
}

/** Baselines of the five rows, two groups. */
const BASELINES = [184, 278, 386, 516, 604];
const GROUP_Y = [84, 432];

export function KeycapProfiles({ locale, className, title }: DiagramProps) {
  const t = LABELS[locale];
  return (
    <DiagramSvg id="keycap-profiles" title={title} className={className} height={626}>
      <g data-part="rows">
        {COLUMNS.map((x, i) => (
          <Label
            key={x}
            x={x}
            y={34}
            lines={`R${i + 1}`}
            anchor="middle"
            weight={600}
            fill={LINE}
          />
        ))}
      </g>

      {[t.sculpted, t.uniform].map((text, g) => (
        <g key={text} data-part="group">
          <rect
            x={LABEL_X}
            y={pick(GROUP_Y, g) - 17}
            width={6}
            height={22}
            rx={2}
            fill={g === 0 ? ACCENT_2 : ACCENT}
          />
          <Label x={LABEL_X + 16} y={pick(GROUP_Y, g)} lines={text} weight={600} />
          <line
            x1={LABEL_X}
            y1={pick(GROUP_Y, g) + 14}
            x2={624}
            y2={pick(GROUP_Y, g) + 14}
            stroke={LINE}
            strokeWidth={SW}
            opacity={0.5}
          />
        </g>
      ))}

      {PROFILES.map((p, r) => {
        const base = pick(BASELINES, r);
        const depth = p.top === 'spherical' ? 5 : 2;
        return (
          <g key={p.name} data-part="profile" data-profile={p.name.toLowerCase()}>
            <Label x={LABEL_X} y={base - 32} lines={p.name} weight={600} />
            <Label x={LABEL_X} y={base - 6} lines={t[p.top]} fill={LINE} />
            <line
              x1={pick(COLUMNS, 0) - 52}
              y1={base}
              x2={pick(COLUMNS, 3) + 52}
              y2={base}
              stroke={LINE}
              strokeWidth={SW}
            />
            {COLUMNS.map((x, i) => (
              <path
                key={x}
                d={keyPath(
                  x,
                  base,
                  pick(p.heights, i),
                  p.sculpted ? pick(TILT, i) : 0,
                  p.topHalf,
                  depth,
                )}
                fill={FILL_2}
                stroke={INK}
                strokeWidth={SW}
              />
            ))}
          </g>
        );
      })}
    </DiagramSvg>
  );
}
