import {
  ACCENT,
  ACCENT_2,
  ArrowHead,
  DiagramSvg,
  FILL,
  FILL_2,
  INK,
  LINE,
  Label,
  Leader,
  SW,
  SW_STRONG,
  type DiagramProps,
} from './parts';

const LABELS = {
  en: {
    rest: '0 mm · rest',
    actuation: 'actuation, e.g. 2 mm',
    travel: 'total travel, e.g. 4 mm',
    stem: 'Stem',
    spring: 'Spring',
    housing: 'Housing',
  },
  ro: {
    rest: '0 mm · repaus',
    actuation: 'actuare, ex. 2 mm',
    travel: 'cursă totală, ex. 4 mm',
    stem: 'Tijă',
    spring: 'Arc',
    housing: 'Carcasă',
  },
} as const;

/** Horizontal centre of the switch. */
const CX = 180;
/** 1 mm of travel in viewBox units. */
const MM = 30;
const REST = 84;
const ACTUATION = REST + 2 * MM;
const BOTTOM = REST + 4 * MM;
const SCALE_X = 352;
const TEXT_X = 372;

function spring(top: number, bottom: number, half: number, turns: number) {
  const step = (bottom - top) / (turns * 2);
  let d = `M${CX} ${top} L${CX - half} ${top + step / 2}`;
  for (let i = 1; i < turns * 2; i++) {
    d += ` L${CX + (i % 2 === 1 ? half : -half)} ${top + step / 2 + i * step}`;
  }
  d += ` L${CX} ${bottom}`;
  return d;
}

export function SwitchTravel({ locale, className, title }: DiagramProps) {
  const t = LABELS[locale];
  const housingTop = BOTTOM + 6;
  return (
    <DiagramSvg id="switch-travel" title={title} className={className} height={396}>
      {/* housing, in section: walls with a hollow interior */}
      <g data-part="housing">
        <path
          d={`M${CX - 78} ${housingTop} H${CX + 78} L${CX + 92} ${housingTop + 64} V${housingTop + 140} H${CX - 92} V${housingTop + 64} Z`}
          fill={FILL_2}
          stroke={INK}
          strokeWidth={SW}
        />
        <line
          x1={CX - 92}
          y1={housingTop + 64}
          x2={CX + 92}
          y2={housingTop + 64}
          stroke={LINE}
          strokeWidth={SW}
        />
        <rect
          x={CX - 50}
          y={housingTop + 8}
          width={100}
          height={124}
          fill={FILL}
          stroke={INK}
          strokeWidth={SW}
        />
        <g stroke={INK} strokeWidth={SW_STRONG}>
          <line x1={CX - 44} y1={housingTop + 140} x2={CX - 44} y2={housingTop + 166} />
          <line x1={CX + 36} y1={housingTop + 140} x2={CX + 36} y2={housingTop + 166} />
        </g>
      </g>

      <g data-part="spring">
        <path
          d={spring(housingTop + 62, housingTop + 130, 26, 4)}
          fill="none"
          stroke={INK}
          strokeWidth={SW}
        />
      </g>

      <g data-part="stem">
        <path
          d={`M${CX - 13} ${REST} H${CX + 13} V${housingTop + 18} H${CX + 40} V${housingTop + 60} H${CX - 40} V${housingTop + 18} H${CX - 13} Z`}
          fill={ACCENT}
          stroke={INK}
          strokeWidth={SW}
        />
      </g>

      {/* part labels */}
      <Leader
        points={[
          [CX - 13, 118],
          [96, 118],
        ]}
      />
      <Label x={86} y={125} lines={t.stem} anchor="end" weight={600} />
      <Leader
        points={[
          [CX + 24, housingTop + 100],
          [SCALE_X + 8, housingTop + 100],
        ]}
      />
      <Label x={TEXT_X} y={housingTop + 107} lines={t.spring} weight={600} />
      <Leader
        points={[
          [CX + 84, housingTop + 120],
          [SCALE_X + 8, housingTop + 140],
        ]}
      />
      <Label x={TEXT_X} y={housingTop + 147} lines={t.housing} weight={600} />

      {/* scale */}
      <line x1={SCALE_X} y1={REST} x2={SCALE_X} y2={BOTTOM} stroke={LINE} strokeWidth={SW} />
      <g data-part="rest">
        <line
          x1={CX + 13}
          y1={REST}
          x2={SCALE_X + 8}
          y2={REST}
          stroke={LINE}
          strokeWidth={SW}
          strokeDasharray="6 6"
        />
        <Label x={TEXT_X} y={REST + 7} lines={t.rest} />
      </g>

      <g data-part="actuation">
        <line
          x1={CX + 13}
          y1={ACTUATION}
          x2={SCALE_X + 8}
          y2={ACTUATION}
          stroke={ACCENT}
          strokeWidth={SW}
          strokeDasharray="6 6"
        />
        <circle cx={SCALE_X} cy={ACTUATION} r={6} fill={ACCENT} stroke="none" />
        <Label x={TEXT_X} y={ACTUATION + 7} lines={t.actuation} weight={600} fill={ACCENT} />
      </g>

      <g data-part="travel">
        <line
          x1={CX + 13}
          y1={BOTTOM}
          x2={SCALE_X + 8}
          y2={BOTTOM}
          stroke={ACCENT_2}
          strokeWidth={SW}
          strokeDasharray="6 6"
        />
        <line
          x1={SCALE_X - 16}
          y1={REST + 10}
          x2={SCALE_X - 16}
          y2={BOTTOM - 10}
          stroke={ACCENT_2}
          strokeWidth={SW_STRONG}
        />
        <ArrowHead x={SCALE_X - 16} y={REST + 2} dir="up" fill={ACCENT_2} />
        <ArrowHead x={SCALE_X - 16} y={BOTTOM - 2} dir="down" fill={ACCENT_2} />
        <Label x={TEXT_X} y={BOTTOM + 7} lines={t.travel} weight={600} fill={ACCENT_2} />
      </g>

      {/* ticks */}
      <g stroke={INK} strokeWidth={SW}>
        {[REST, ACTUATION, BOTTOM].map((y) => (
          <line key={y} x1={SCALE_X - 6} y1={y} x2={SCALE_X + 6} y2={y} />
        ))}
      </g>
    </DiagramSvg>
  );
}
