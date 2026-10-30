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
 * Five keyboard sizes drawn to the same scale, as block regions (not individual keys).
 * Coordinates are in key units (1u = one standard key).
 */

type Region = 'alpha' | 'f-row' | 'nav' | 'numpad';

const LABELS = {
  en: {
    regions: {
      alpha: 'Alphanumeric',
      'f-row': 'F-row',
      nav: 'Navigation, arrows',
      numpad: 'Numpad',
    } satisfies Record<Region, string>,
    boards: {
      full: 'full size',
      tkl: 'no numpad',
      75: 'nav keys in one column',
      65: 'no F-row, arrows kept',
      60: 'no F-row, no arrows',
    },
  },
  ro: {
    regions: {
      alpha: 'Alfanumeric',
      'f-row': 'Rândul F',
      nav: 'Navigare, săgeți',
      numpad: 'Numeric',
    } satisfies Record<Region, string>,
    boards: {
      full: 'mărime completă',
      tkl: 'fără bloc numeric',
      75: 'navigare pe o coloană',
      65: 'fără rând F, cu săgeți',
      60: 'fără rând F, fără săgeți',
    },
  },
} as const;

const REGION_FILL: Record<Region, string> = {
  alpha: FILL_2,
  'f-row': LINE,
  nav: ACCENT,
  numpad: ACCENT_2,
};

/** A block: either a rectangle [x, y, w, h] or a polygon of [x, y] points. */
interface Block {
  region: Region;
  rect?: [number, number, number, number];
  poly?: [number, number][];
}

const FULL_TOP: Block[] = [
  { region: 'f-row', rect: [0, 0, 15, 1] },
  { region: 'nav', rect: [15.25, 0, 3, 1] },
  { region: 'alpha', rect: [0, 1.25, 15, 5] },
  { region: 'nav', rect: [15.25, 1.25, 3, 2] },
  {
    region: 'nav',
    poly: [
      [16.25, 4.25],
      [17.25, 4.25],
      [17.25, 5.25],
      [18.25, 5.25],
      [18.25, 6.25],
      [15.25, 6.25],
      [15.25, 5.25],
      [16.25, 5.25],
    ],
  },
];

const compact = (dy: number): Block[] => [
  {
    region: 'alpha',
    poly: [
      [0, dy],
      [15, dy],
      [15, dy + 3],
      [14, dy + 3],
      [14, dy + 4],
      [13, dy + 4],
      [13, dy + 5],
      [0, dy + 5],
    ],
  },
  { region: 'nav', rect: [15, dy, 1, 4] },
  {
    region: 'nav',
    poly: [
      [14, dy + 3],
      [15, dy + 3],
      [15, dy + 4],
      [16, dy + 4],
      [16, dy + 5],
      [13, dy + 5],
      [13, dy + 4],
      [14, dy + 4],
    ],
  },
];

const BOARDS: {
  name: string;
  key: keyof (typeof LABELS)['en']['boards'];
  width: number;
  height: number;
  blocks: Block[];
}[] = [
  {
    name: '100%',
    key: 'full',
    width: 22.5,
    height: 6.25,
    blocks: [...FULL_TOP, { region: 'numpad', rect: [18.5, 1.25, 4, 5] }],
  },
  { name: 'TKL', key: 'tkl', width: 18.25, height: 6.25, blocks: FULL_TOP },
  {
    name: '75%',
    key: 75,
    width: 16,
    height: 6.25,
    blocks: [{ region: 'f-row', rect: [0, 0, 16, 1] }, ...compact(1.25)],
  },
  { name: '65%', key: 65, width: 16, height: 5, blocks: compact(0) },
  {
    name: '60%',
    key: 60,
    width: 15,
    height: 5,
    blocks: [{ region: 'alpha', rect: [0, 0, 15, 5] }],
  },
];

const U = 12.5;
const COL_X = [24, 336];
const ROW_Y = [16, 186, 356];
const BOARD_DY = 66;

export function LayoutSizes({ locale, className, title }: DiagramProps) {
  const t = LABELS[locale];
  const cells = [...BOARDS.map((b) => ({ board: b })), { board: null }];
  return (
    <DiagramSvg id="layout-sizes" title={title} className={className} height={506}>
      {cells.map(({ board }, i) => {
        const ox = pick(COL_X, i % 2);
        const oy = pick(ROW_Y, Math.floor(i / 2));
        if (!board) {
          return (
            <g key="legend" data-part="legend">
              {(Object.keys(REGION_FILL) as Region[]).map((r, j) => (
                <g key={r}>
                  <rect
                    x={ox}
                    y={oy + 12 + j * 32}
                    width={22}
                    height={18}
                    rx={3}
                    fill={REGION_FILL[r]}
                    stroke={INK}
                    strokeWidth={SW}
                  />
                  <Label x={ox + 34} y={oy + 28 + j * 32} lines={t.regions[r]} />
                </g>
              ))}
            </g>
          );
        }
        const bx = ox;
        const by = oy + BOARD_DY;
        return (
          <g key={board.name} data-part="layout" data-layout={board.name}>
            <Label x={ox} y={oy + 22} lines={board.name} weight={600} />
            <Label x={ox} y={oy + 48} lines={t.boards[board.key]} fill={LINE} />
            <rect
              x={bx - 6}
              y={by - 6}
              width={board.width * U + 12}
              height={board.height * U + 12}
              rx={6}
              fill="none"
              stroke={LINE}
              strokeWidth={SW}
            />
            {board.blocks.map((b, j) =>
              b.rect ? (
                <rect
                  key={j}
                  data-region={b.region}
                  x={bx + b.rect[0] * U}
                  y={by + b.rect[1] * U}
                  width={b.rect[2] * U}
                  height={b.rect[3] * U}
                  rx={2}
                  fill={REGION_FILL[b.region]}
                  stroke={INK}
                  strokeWidth={SW}
                />
              ) : (
                <polygon
                  key={j}
                  data-region={b.region}
                  points={(b.poly ?? []).map(([x, y]) => `${bx + x * U},${by + y * U}`).join(' ')}
                  fill={REGION_FILL[b.region]}
                  stroke={INK}
                  strokeWidth={SW}
                />
              ),
            )}
          </g>
        );
      })}
    </DiagramSvg>
  );
}
