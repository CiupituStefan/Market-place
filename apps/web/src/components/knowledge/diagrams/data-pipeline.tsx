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
  SW,
  SW_STRONG,
  pick,
  type DiagramProps,
} from './parts';

/**
 * From key press to character on screen, in six stages (two rows of three). Stage 5 is the
 * wireless path; USB is drawn as the wired alternative from the HID report to the host.
 */

interface Stage {
  title: string[];
  note?: string[];
}

const LABELS: Record<'en' | 'ro', { stages: Stage[]; usb: string }> = {
  en: {
    stages: [
      { title: ['Switch', 'actuation'], note: ['mechanical →', 'electrical'] },
      { title: ['Matrix scan'], note: ['+ debounce'] },
      { title: ['Keymap &', 'layer lookup'] },
      { title: ['HID report'] },
      { title: ['BLE', 'transmission'], note: ['encrypted, at', 'the connection', 'event'] },
      { title: ['Host decodes', '& shows the', 'character'] },
    ],
    usb: 'USB: the wired alternative',
  },
  ro: {
    stages: [
      { title: ['Acționarea', 'switch-ului'], note: ['mecanic →', 'electric'] },
      { title: ['Scanare', 'matrice'], note: ['+ debounce'] },
      { title: ['Căutare în', 'keymap și', 'straturi'] },
      { title: ['Raport HID'] },
      { title: ['Transmisie', 'BLE'], note: ['criptată, la', 'evenimentul', 'de conexiune'] },
      { title: ['Gazda', 'decodează și', 'afișează', 'caracterul'] },
    ],
    usb: 'USB: alternativa prin cablu',
  },
};

const BOX_W = 186;
const BOX_H = 200;
const GAP_X = (640 - 24 - 3 * BOX_W) / 2;
const ROW_Y = [16, 268];
const ROW_GAP = pick(ROW_Y, 1) - pick(ROW_Y, 0) - BOX_H;

const boxX = (col: number) => 12 + col * (BOX_W + GAP_X);

export function DataPipeline({ locale, className, title }: DiagramProps) {
  const t = LABELS[locale];
  const turnY = pick(ROW_Y, 0) + BOX_H + ROW_GAP / 2;
  const usbY = pick(ROW_Y, 1) + BOX_H + 30;
  return (
    <DiagramSvg id="data-pipeline" title={title} className={className} height={548}>
      {/* flow arrows */}
      <g data-part="flow" stroke={INK} strokeWidth={SW} fill="none">
        {[0, 1].map((row) =>
          [0, 1].map((col) => {
            const y = pick(ROW_Y, row) + 44;
            const x1 = boxX(col) + BOX_W;
            const x2 = boxX(col + 1);
            return (
              <g key={`${row}-${col}`}>
                <line x1={x1 + 4} y1={y} x2={x2 - 10} y2={y} />
                <ArrowHead x={x2 - 3} y={y} dir="right" />
              </g>
            );
          }),
        )}
        <path
          d={`M${boxX(2) + BOX_W / 2} ${pick(ROW_Y, 0) + BOX_H + 4} V${turnY} H${boxX(0) + BOX_W / 2} V${pick(ROW_Y, 1) - 10}`}
        />
        <ArrowHead x={boxX(0) + BOX_W / 2} y={pick(ROW_Y, 1) - 3} dir="down" />
      </g>

      {/* the wired alternative: from the HID report straight to the host */}
      <g data-part="usb">
        <path
          d={`M${boxX(0) + BOX_W / 2} ${pick(ROW_Y, 1) + BOX_H + 4} V${usbY} H${boxX(2) + BOX_W / 2} V${pick(ROW_Y, 1) + BOX_H + 12}`}
          fill="none"
          stroke={ACCENT_2}
          strokeWidth={SW_STRONG}
          strokeDasharray="8 7"
        />
        <ArrowHead
          x={boxX(2) + BOX_W / 2}
          y={pick(ROW_Y, 1) + BOX_H + 4}
          dir="up"
          fill={ACCENT_2}
        />
        <Label
          x={boxX(1) + BOX_W / 2}
          y={usbY + 30}
          lines={t.usb}
          anchor="middle"
          weight={600}
          fill={ACCENT_2}
        />
      </g>

      {t.stages.map((s, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = boxX(col);
        const y = pick(ROW_Y, row);
        const wireless = i === 4;
        const titleY = y + 88;
        return (
          <g key={i} data-part="stage" data-stage={i + 1}>
            <rect
              x={x}
              y={y}
              width={BOX_W}
              height={BOX_H}
              rx={8}
              fill={wireless ? FILL_2 : FILL}
              stroke={wireless ? ACCENT : INK}
              strokeWidth={wireless ? SW_STRONG : SW}
            />
            <circle cx={x + 30} cy={y + 44} r={17} fill={wireless ? ACCENT : INK} stroke="none" />
            <Label
              x={x + 30}
              y={y + 51}
              lines={String(i + 1)}
              anchor="middle"
              weight={700}
              fill={FILL}
            />
            <Label x={x + 16} y={titleY} lines={s.title} weight={600} />
            {s.note ? (
              <Label
                x={x + 16}
                y={titleY + s.title.length * 26}
                lines={s.note}
                fill={wireless ? ACCENT : LINE}
              />
            ) : null}
          </g>
        );
      })}
    </DiagramSvg>
  );
}
