import type { ReactNode } from 'react';

import type { DiagramId } from '@/lib/knowledge/types';

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
  type DiagramProps,
} from './parts';

/**
 * The six mounting styles as one family of partial cross-sections: the left wall of the case
 * and the first switches, cut off by a break line on the right. Same geometry everywhere; only
 * the way the plate (copper) is held changes.
 */

type Variant = 'integrated' | 'tray' | 'top' | 'bottom' | 'sandwich' | 'gasket';

const HEIGHT = 312;
/** The section is drawn at this scale so the small parts read on a phone. */
const SCALE = 1.25;
/** Stroke inside the scaled drawing, so it renders at SW. */
const SWD = SW / SCALE;
/** Where the case's outer top-left corner lands on screen. */
const ORIGIN_X = 236;
const ORIGIN_Y = 30;
/** Outer and inner face of the case wall. */
const WALL_O = 210;
const WALL_I = 240;
/** Lip of the top half (bezel). */
const LIP_R = 276;
const TOP = 96;
const LIP_B = 124;
/** Plate and PCB levels. */
const PLATE_T = 160;
const PLATE_B = 168;
const PCB_T = 188;
const PCB_B = 200;
const FLOOR_T = 280;
const FLOOR_B = 296;
/** The drawing is cut here. */
const BREAK = 604;
/** Break in drawing coordinates. */
const BREAK_D = WALL_O + (BREAK - ORIGIN_X) / SCALE;
const RUN = BREAK_D + 30;
const SWITCHES = [315, 385, 485, 555];
const TRAY_SCREW = 435;
const LABEL_X = 16;
const LEADER_X = 220;

const WORDS = {
  en: {
    caseTop: 'Case top',
    caseBottom: 'Case bottom',
    plate: 'Plate',
    plateIntegrated: 'Plate, built in',
    plateTab: 'Plate tab',
    pcb: 'PCB',
    screw: 'Screw',
    post: 'Standoff post',
    tray: 'Case (tray)',
    gasket: 'Gaskets',
    switches: 'Switches',
  },
  ro: {
    caseTop: 'Carcasă sus',
    caseBottom: 'Carcasă jos',
    plate: 'Placă',
    plateIntegrated: 'Placă integrată',
    plateTab: 'Ureche placă',
    pcb: 'PCB',
    screw: 'Șurub',
    post: 'Distanțier',
    tray: 'Carcasă (tavă)',
    gasket: 'Garnituri',
    switches: 'Switch-uri',
  },
} as const;

type Word = keyof (typeof WORDS)['en'];

interface Callout {
  word: Word;
  /** Baseline of the label when the leader bends; otherwise the label sits level with the part. */
  y?: number;
  /** Point on the part. */
  at: readonly [number, number];
  /** Drawing x of an optional bend: the leader runs vertically from the part to the label's level. */
  bendX?: number;
}

const box = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y} H${x + w} V${y + h} H${x} Z`;

function Part({
  d,
  fill = FILL_2,
  part,
  children,
}: {
  d: string;
  fill?: string;
  part: string;
  children?: ReactNode;
}) {
  return (
    <g data-part={part}>
      <path d={d} fill={fill} stroke={INK} strokeWidth={SWD} />
      {children}
    </g>
  );
}

function Screw({
  x,
  headY,
  tipY,
  headDown = false,
}: {
  x: number;
  headY: number;
  tipY: number;
  headDown?: boolean;
}) {
  const shaftTop = headDown ? tipY : headY + 8;
  const shaftBottom = headDown ? headY : tipY;
  return (
    <g>
      <rect
        x={x - 4}
        y={Math.min(shaftTop, shaftBottom)}
        width={8}
        height={Math.abs(shaftBottom - shaftTop)}
        fill={FILL}
        stroke={INK}
        strokeWidth={SWD}
      />
      <rect
        x={x - 11}
        y={headY}
        width={22}
        height={8}
        rx={2}
        fill={INK}
        stroke={INK}
        strokeWidth={SWD}
      />
    </g>
  );
}

function Switches() {
  return (
    <g data-part="switches">
      {SWITCHES.map((x) => (
        <g key={x} stroke={INK} strokeWidth={SWD}>
          <rect x={x - 22} y={PLATE_B} width={44} height={PCB_T - PLATE_B} fill={FILL} />
          <rect x={x - 6} y={108} width={12} height={14} fill={FILL_2} />
          <path d={`M${x - 22} 122 H${x + 22} L${x + 27} ${PLATE_T} H${x - 27} Z`} fill={FILL} />
        </g>
      ))}
    </g>
  );
}

function Plate({ from }: { from: number }) {
  return (
    <g data-part="plate">
      <path
        d={box(from, PLATE_T, RUN - from, PLATE_B - PLATE_T)}
        fill={ACCENT_2}
        stroke={INK}
        strokeWidth={SWD}
      />
    </g>
  );
}

function Pcb({ from }: { from: number }) {
  return (
    <g data-part="pcb">
      <path
        d={box(from, PCB_T, RUN - from, PCB_B - PCB_T)}
        fill={FILL_2}
        stroke={INK}
        strokeWidth={SWD}
      />
    </g>
  );
}

/** A bottom half (or a tray) whose wall starts at `wallTop`. */
const bottomHalf = (wallTop: number) =>
  `M${WALL_O} ${wallTop} H${WALL_I} V${FLOOR_T} H${RUN} V${FLOOR_B} H${WALL_O} Z`;

function body(variant: Variant): { drawing: ReactNode; callouts: Callout[] } {
  switch (variant) {
    case 'integrated': {
      const split = 230;
      const top = `M${WALL_O} ${TOP} H${LIP_R} V${LIP_B} H${WALL_I} V${PLATE_T} H${RUN} V${PLATE_B} H${WALL_I} V${split} H${WALL_O} Z`;
      return {
        drawing: (
          <>
            <Pcb from={250} />
            <g data-part="case-top">
              {/* one piece: wall in grey, plate area in copper, a single outline */}
              <path
                d={`M${WALL_O} ${TOP} H${LIP_R} V${LIP_B} H${WALL_I} V${split} H${WALL_O} Z`}
                fill={FILL_2}
                stroke="none"
              />
              <g data-part="plate">
                <rect
                  x={WALL_I}
                  y={PLATE_T}
                  width={RUN - WALL_I}
                  height={PLATE_B - PLATE_T}
                  fill={ACCENT_2}
                />
              </g>
              <path d={top} fill="none" stroke={INK} strokeWidth={SWD} />
            </g>
            <Part part="case-bottom" d={bottomHalf(split)} />
          </>
        ),
        callouts: [
          { word: 'caseTop', at: [WALL_O + 12, 110] },
          { word: 'plateIntegrated', at: [WALL_I + 30, 164] },
          { word: 'pcb', at: [WALL_I + 30, 194] },
          { word: 'caseBottom', at: [WALL_O + 12, 255] },
        ],
      };
    }
    case 'tray': {
      const post = box(TRAY_SCREW - 12, PCB_B, 24, FLOOR_T - PCB_B);
      return {
        drawing: (
          <>
            <Part part="case" d={bottomHalf(140)} />
            <g data-part="posts">
              <path d={post} fill={FILL_2} stroke={INK} strokeWidth={SWD} />
            </g>
            <Pcb from={250} />
            <Plate from={250} />
            <g data-part="screws">
              <Screw x={TRAY_SCREW} headY={PLATE_T - 8} tipY={PCB_B + 44} />
            </g>
          </>
        ),
        callouts: [
          { word: 'screw', y: 30, at: [TRAY_SCREW, PLATE_T - 8], bendX: TRAY_SCREW },
          { word: 'plate', at: [WALL_I + 30, 164] },
          { word: 'pcb', at: [WALL_I + 30, 194] },
          { word: 'post', at: [TRAY_SCREW - 12, 240] },
          { word: 'tray', at: [WALL_O + 12, 288] },
        ],
      };
    }
    case 'top': {
      const split = 230;
      const boss = 246;
      const top = `M${WALL_O} ${TOP} H${LIP_R} V${PLATE_T} H${WALL_I} V${split} H${WALL_O} Z`;
      return {
        drawing: (
          <>
            <Pcb from={290} />
            <Plate from={boss} />
            <Part part="case-top" d={top} />
            <Part part="case-bottom" d={bottomHalf(split)} />
            <g data-part="screws">
              <Screw x={(boss + LIP_R) / 2 + 3} headY={PLATE_B} tipY={PLATE_T - 28} headDown />
            </g>
          </>
        ),
        callouts: [
          { word: 'caseTop', at: [WALL_O + 12, 110] },
          { word: 'plateTab', at: [252, 164] },
          { word: 'screw', y: 162, at: [264, PLATE_B + 8], bendX: 264 },
          { word: 'pcb', y: 200, at: [300, PCB_B], bendX: 300 },
          { word: 'caseBottom', at: [WALL_O + 12, 261] },
        ],
      };
    }
    case 'bottom': {
      const split = 200;
      /** The bottom half with a boss rising from the floor up to the plate. */
      const bottom = `M${WALL_O} ${split} H${WALL_I} V${PLATE_B} H278 V${FLOOR_T} H${RUN} V${FLOOR_B} H${WALL_O} Z`;
      const top = `M${WALL_O} ${TOP} H${LIP_R} V${LIP_B} H${WALL_I} V${split} H${WALL_O} Z`;
      return {
        drawing: (
          <>
            <Pcb from={290} />
            <Part part="case-top" d={top} />
            <Part part="case-bottom" d={bottom} />
            <Plate from={WALL_I + 4} />
            <g data-part="screws">
              <Screw x={262} headY={PLATE_T - 8} tipY={PLATE_B + 40} />
            </g>
          </>
        ),
        callouts: [
          { word: 'caseTop', at: [WALL_O + 12, 110] },
          { word: 'screw', y: 92, at: [262, PLATE_T - 8], bendX: 262 },
          { word: 'plate', at: [282, 164] },
          { word: 'pcb', y: 200, at: [300, PCB_B], bendX: 300 },
          { word: 'caseBottom', at: [WALL_O + 12, 261] },
        ],
      };
    }
    case 'sandwich': {
      const top = `M${WALL_O} ${TOP} H${LIP_R} V${LIP_B} H${WALL_I} V${PLATE_T} H${WALL_O} Z`;
      const bottom = `M${WALL_O} ${PLATE_B} H${WALL_I} V${FLOOR_T} H${RUN} V${FLOOR_B} H${WALL_O} Z`;
      return {
        drawing: (
          <>
            <Pcb from={250} />
            <Part part="case-top" d={top} />
            <Part part="case-bottom" d={bottom} />
            <Plate from={WALL_O} />
            <g data-part="screws">
              <Screw x={WALL_O + 15} headY={FLOOR_B} tipY={LIP_B + 6} headDown />
            </g>
          </>
        ),
        callouts: [
          { word: 'caseTop', at: [WALL_O + 24, 110] },
          { word: 'plate', at: [WALL_I + 30, 164] },
          { word: 'pcb', at: [WALL_I + 30, 194] },
          { word: 'caseBottom', at: [WALL_O + 24, 240] },
          { word: 'screw', at: [WALL_O + 4, FLOOR_B + 4] },
        ],
      };
    }
    case 'gasket': {
      const ledge = 70;
      const split = 150;
      const top = `M${WALL_O} ${TOP} H${LIP_R} V${LIP_B} H${WALL_I} V${PLATE_T - 20} H${WALL_O + ledge} V${split} H${WALL_O} Z`;
      const bottom = `M${WALL_O} ${split} H${WALL_I} V${PLATE_B + 10} H${WALL_O + ledge} V${PLATE_B + 20} H${WALL_I} V${FLOOR_T} H${RUN} V${FLOOR_B} H${WALL_O} Z`;
      const gx = WALL_I + 6;
      const gw = WALL_O + ledge - gx;
      return {
        drawing: (
          <>
            <Pcb from={290} />
            <Part part="case-top" d={top} />
            <Part part="case-bottom" d={bottom} />
            <Plate from={WALL_I + 2} />
            <g data-part="gaskets">
              <rect
                x={gx}
                y={split}
                width={gw}
                height={PLATE_T - split}
                rx={4}
                fill={ACCENT}
                stroke={INK}
                strokeWidth={SWD}
              />
              <rect
                x={gx}
                y={PLATE_B}
                width={gw}
                height={10}
                rx={4}
                fill={ACCENT}
                stroke={INK}
                strokeWidth={SWD}
              />
            </g>
          </>
        ),
        callouts: [
          { word: 'caseTop', at: [WALL_O + 12, 110] },
          { word: 'gasket', at: [gx + 6, PLATE_T - 5] },
          { word: 'plate', y: 150, at: [WALL_O + ledge + 4, 164], bendX: WALL_O + ledge + 4 },
          { word: 'pcb', y: 200, at: [300, PCB_B], bendX: 300 },
          { word: 'caseBottom', at: [WALL_O + 12, 261] },
        ],
      };
    }
  }
}

function toScreen([x, y]: readonly [number, number]): [number, number] {
  return [ORIGIN_X + (x - WALL_O) * SCALE, ORIGIN_Y + (y - TOP) * SCALE];
}

function MountSection({
  id,
  variant,
  locale,
  className,
  title,
}: DiagramProps & { id: DiagramId; variant: Variant }) {
  const words = WORDS[locale];
  const { drawing, callouts } = body(variant);
  const clipId = `diagram-${id}-clip`;
  return (
    <DiagramSvg id={id} title={title} className={className} height={HEIGHT}>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={BREAK} height={HEIGHT} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g
          transform={`translate(${ORIGIN_X - WALL_O * SCALE} ${ORIGIN_Y - TOP * SCALE}) scale(${SCALE})`}
        >
          {drawing}
          <Switches />
        </g>
      </g>
      {/* break line: the section continues to the right */}
      <path
        d={`M${BREAK} 22 V136 L${BREAK - 9} 148 L${BREAK + 9} 166 L${BREAK} 178 V298`}
        fill="none"
        stroke={LINE}
        strokeWidth={SW}
      />
      <g data-part="labels">
        {callouts.map((c) => {
          const at = toScreen(c.at);
          const level = c.bendX === undefined || c.y === undefined ? at[1] : c.y - 7;
          const bend: [number, number][] =
            c.bendX === undefined ? [] : [[toScreen([c.bendX, 0])[0], level]];
          return (
            <g key={c.word}>
              <Leader points={[at, ...bend, [LEADER_X, level]]} />
              <Label x={LABEL_X} y={level + 7} lines={words[c.word]} weight={600} />
            </g>
          );
        })}
      </g>
    </DiagramSvg>
  );
}

export function MountIntegrated(props: DiagramProps) {
  return <MountSection {...props} id="mount-integrated" variant="integrated" />;
}
export function MountTray(props: DiagramProps) {
  return <MountSection {...props} id="mount-tray" variant="tray" />;
}
export function MountTop(props: DiagramProps) {
  return <MountSection {...props} id="mount-top" variant="top" />;
}
export function MountBottom(props: DiagramProps) {
  return <MountSection {...props} id="mount-bottom" variant="bottom" />;
}
export function MountSandwich(props: DiagramProps) {
  return <MountSection {...props} id="mount-sandwich" variant="sandwich" />;
}
export function MountGasket(props: DiagramProps) {
  return <MountSection {...props} id="mount-gasket" variant="gasket" />;
}
