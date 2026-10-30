import {
  ACCENT,
  ACCENT_2,
  ArrowHead,
  DiagramSvg,
  FILL,
  INK,
  LINE,
  Label,
  SW,
  SW_STRONG,
  pick,
  type DiagramProps,
} from './parts';

/**
 * Li-ion charge cycle: battery voltage (blue) and charge current (copper) over time through
 * pre-charge, constant current, constant voltage and termination. Shapes only; the only values
 * are the ones the thesis gives (~2.9 V, 4.2 V, ~10 %).
 */

const LABELS = {
  en: {
    phases: [
      ['Pre-charge', '(trickle)'],
      ['CC', 'constant', 'current'],
      ['CV', 'constant', 'voltage'],
      ['End'],
    ],
    voltage: 'voltage',
    current: 'current',
    time: 'time',
    termination: 'Termination: current below ~10% of max',
  },
  ro: {
    phases: [
      ['Preîncărcare', '(trickle)'],
      ['CC', 'curent', 'constant'],
      ['CV', 'tensiune', 'constantă'],
      ['Final'],
    ],
    voltage: 'tensiune',
    current: 'curent',
    time: 'timp',
    termination: 'Terminare: curent sub ~10% din maxim',
  },
} as const;

const PLOT_L = 86;
const PLOT_R = 600;
const PLOT_T = 140;
const PLOT_B = 410;
/** Phase boundaries on the time axis. */
const X_PRE = 238;
const X_CC = 378;
const X_END = 532;
const V_42 = 168;
const V_29 = 290;
const I_MAX = 196;
const I_PRE = 382;
/** ~10 % of the maximum current above the zero line. */
const I_END = PLOT_B - (PLOT_B - I_MAX) * 0.1;

export function ChargeCycle({ locale, className, title }: DiagramProps) {
  const t = LABELS[locale];
  const bounds = [PLOT_L, X_PRE, X_CC, X_END, PLOT_R];
  const voltage = `M${PLOT_L} 342 C${PLOT_L + 50} 330 ${X_PRE - 40} 302 ${X_PRE} ${V_29} C${X_PRE + 50} 250 ${X_CC - 60} ${V_42 + 8} ${X_CC} ${V_42} H${PLOT_R}`;
  const current = `M${PLOT_L} ${I_PRE} H${X_PRE} V${I_MAX} H${X_CC} C${X_CC + 50} ${I_MAX + 150} ${X_END - 70} ${I_END - 4} ${X_END} ${I_END} V${PLOT_B} H${PLOT_R}`;
  return (
    <DiagramSvg id="charge-cycle" title={title} className={className} height={512}>
      <g data-part="phases">
        {t.phases.map((lines, i) => {
          const x1 = pick(bounds, i);
          const x2 = pick(bounds, i + 1);
          return (
            <g key={i} data-part="phase" data-phase={i}>
              {i % 2 === 1 ? (
                <rect
                  x={x1}
                  y={PLOT_T - 124}
                  width={x2 - x1}
                  height={PLOT_B - PLOT_T + 124}
                  fill={FILL}
                  stroke="none"
                />
              ) : null}
              <Label x={(x1 + x2) / 2} y={PLOT_T - 94} lines={lines} anchor="middle" weight={600} />
            </g>
          );
        })}
        <g stroke={LINE} strokeWidth={SW} strokeDasharray="3 6">
          {[X_PRE, X_CC, X_END].map((x) => (
            <line key={x} x1={x} y1={PLOT_T - 124} x2={x} y2={PLOT_B} />
          ))}
        </g>
      </g>

      {/* reference levels */}
      <g data-part="levels">
        <line
          x1={PLOT_L}
          y1={V_42}
          x2={PLOT_R}
          y2={V_42}
          stroke={LINE}
          strokeWidth={SW}
          strokeDasharray="6 6"
          opacity={0.6}
        />
        <line
          x1={PLOT_L}
          y1={V_29}
          x2={X_PRE + 40}
          y2={V_29}
          stroke={LINE}
          strokeWidth={SW}
          strokeDasharray="6 6"
          opacity={0.6}
        />
        <Label x={PLOT_L - 10} y={V_42 + 7} lines="4.2 V" anchor="end" fill={ACCENT} weight={600} />
        <Label
          x={PLOT_L - 10}
          y={V_29 + 7}
          lines="~2.9 V"
          anchor="end"
          fill={ACCENT}
          weight={600}
        />
      </g>

      <g data-part="current">
        <path d={current} fill="none" stroke={ACCENT_2} strokeWidth={SW_STRONG} />
        <circle cx={X_END} cy={I_END} r={6} fill={ACCENT_2} stroke="none" />
        <Label x={X_END + 12} y={I_END - 12} lines="~10%" fill={ACCENT_2} weight={600} />
      </g>
      <g data-part="voltage">
        <path d={voltage} fill="none" stroke={ACCENT} strokeWidth={SW_STRONG} />
      </g>

      {/* axes */}
      <g stroke={INK} strokeWidth={SW} fill="none">
        <line x1={PLOT_L} y1={PLOT_T - 6} x2={PLOT_L} y2={PLOT_B} />
        <line x1={PLOT_R} y1={PLOT_T - 6} x2={PLOT_R} y2={PLOT_B} />
        <line x1={PLOT_L} y1={PLOT_B} x2={PLOT_R + 18} y2={PLOT_B} />
      </g>
      <ArrowHead x={PLOT_R + 26} y={PLOT_B} dir="right" />
      <Label x={PLOT_R + 26} y={PLOT_B + 32} lines={t.time} anchor="end" />
      <g data-part="legend">
        <line
          x1={PLOT_L}
          y1={PLOT_B + 30}
          x2={PLOT_L + 30}
          y2={PLOT_B + 30}
          stroke={ACCENT}
          strokeWidth={SW_STRONG}
        />
        <Label x={PLOT_L + 40} y={PLOT_B + 37} lines={t.voltage} />
        <line
          x1={PLOT_L + 170}
          y1={PLOT_B + 30}
          x2={PLOT_L + 200}
          y2={PLOT_B + 30}
          stroke={ACCENT_2}
          strokeWidth={SW_STRONG}
        />
        <Label x={PLOT_L + 210} y={PLOT_B + 37} lines={t.current} />
      </g>
      <Label x={PLOT_L} y={PLOT_B + 82} lines={t.termination} fill={LINE} />
    </DiagramSvg>
  );
}
