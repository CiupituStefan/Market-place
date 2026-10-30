import {
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

const LABELS = {
  en: {
    keycaps: ['Keycaps'],
    switches: ['Switches'],
    plate: ['Plate'],
    pcb: ['PCB'],
    foam: ['Foam'],
    foamSub: 'sound-dampening',
    case: ['Case'],
  },
  ro: {
    keycaps: ['Capace (keycaps)'],
    switches: ['Switch-uri'],
    plate: ['Placă'],
    pcb: ['PCB'],
    foam: ['Spumă'],
    foamSub: 'amortizare fonică',
    case: ['Carcasă'],
  },
} as const;

const KEYS = [84, 168, 252, 336];
const LEFT = 30;
const RIGHT = 390;
const LABEL_X = 432;
const LEADER_END = 420;

export function ExplodedStack({ locale, className, title }: DiagramProps) {
  const t = LABELS[locale];
  return (
    <DiagramSvg id="exploded-stack" title={title} className={className} height={470}>
      {/* centre lines through each key position, as in an exploded drawing */}
      <g stroke={LINE} strokeWidth={SW} strokeDasharray="2 9" opacity={0.6}>
        {KEYS.map((x) => (
          <line key={x} x1={x} y1={16} x2={x} y2={378} />
        ))}
      </g>

      <g data-part="keycaps">
        {KEYS.map((x) => (
          <path
            key={x}
            d={`M${x - 36} 92 L${x - 27} 36 Q${x} 44 ${x + 27} 36 L${x + 36} 92 Z`}
            fill={FILL_2}
            stroke={INK}
            strokeWidth={SW}
          />
        ))}
        <Leader
          points={[
            [pick(KEYS, 3) + 26, 64],
            [LEADER_END, 64],
          ]}
        />
        <Label x={LABEL_X} y={71} lines={t.keycaps} weight={600} />
      </g>

      <g data-part="switches">
        {KEYS.map((x) => (
          <g key={x} stroke={INK} strokeWidth={SW}>
            <rect x={x - 6} y={124} width={12} height={16} fill={FILL_2} />
            <path d={`M${x - 24} 140 H${x + 24} L${x + 30} 166 H${x - 30} Z`} fill={FILL} />
            <rect x={x - 25} y={166} width={50} height={18} fill={FILL} />
            <line x1={x - 10} y1={184} x2={x - 10} y2={196} />
            <line x1={x + 12} y1={184} x2={x + 12} y2={196} />
          </g>
        ))}
        <Leader
          points={[
            [pick(KEYS, 3) + 28, 158],
            [LEADER_END, 158],
          ]}
        />
        <Label x={LABEL_X} y={165} lines={t.switches} weight={600} />
      </g>

      <g data-part="plate">
        <rect
          x={LEFT + 8}
          y={226}
          width={RIGHT - LEFT - 16}
          height={10}
          rx={2}
          fill={ACCENT_2}
          stroke={INK}
          strokeWidth={SW}
        />
        <Leader
          points={[
            [RIGHT - 14, 231],
            [LEADER_END, 231],
          ]}
        />
        <Label x={LABEL_X} y={238} lines={t.plate} weight={600} />
      </g>

      <g data-part="pcb">
        <rect
          x={LEFT + 8}
          y={268}
          width={RIGHT - LEFT - 16}
          height={12}
          rx={2}
          fill={FILL_2}
          stroke={INK}
          strokeWidth={SW}
        />
        {/* components on the underside */}
        {[70, 130, 214, 300].map((x, i) => (
          <rect
            key={x}
            x={x}
            y={280}
            width={i === 1 ? 40 : 18}
            height={7}
            fill={FILL}
            stroke={INK}
            strokeWidth={SW}
          />
        ))}
        <Leader
          points={[
            [RIGHT - 14, 274],
            [LEADER_END, 274],
          ]}
        />
        <Label x={LABEL_X} y={281} lines={t.pcb} weight={600} />
      </g>

      <g data-part="foam">
        <rect
          x={LEFT + 20}
          y={316}
          width={RIGHT - LEFT - 40}
          height={24}
          rx={4}
          fill={FILL}
          stroke={INK}
          strokeWidth={SW}
        />
        {Array.from({ length: 17 }, (_, i) => (
          <g key={i} fill={LINE} stroke="none">
            <circle cx={LEFT + 38 + i * 18.5} cy={324} r={2.5} />
            <circle cx={LEFT + 47 + i * 18.5} cy={333} r={2.5} />
          </g>
        ))}
        <Leader
          points={[
            [RIGHT - 26, 328],
            [LEADER_END, 328],
          ]}
        />
        <Label x={LABEL_X} y={335} lines={t.foam} weight={600} />
        <Label x={LABEL_X} y={361} lines={t.foamSub} fill={LINE} />
      </g>

      <g data-part="case">
        <path
          d={`M${LEFT} 384 V444 Q${LEFT} 454 ${LEFT + 10} 454 H${RIGHT - 10} Q${RIGHT} 454 ${RIGHT} 444 V384 H${RIGHT - 14} V440 H${LEFT + 14} V384 Z`}
          fill={FILL_2}
          stroke={INK}
          strokeWidth={SW}
        />
        <Leader
          points={[
            [RIGHT - 7, 420],
            [LEADER_END, 420],
          ]}
        />
        <Label x={LABEL_X} y={427} lines={t.case} weight={600} />
      </g>
    </DiagramSvg>
  );
}
