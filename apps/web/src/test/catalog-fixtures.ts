import type { Currency, Money } from '@market/types';
import type {
  Availability,
  Badge,
  Category,
  KeyboardLayout,
  Product,
  ProductKind,
  ProductOption,
  ProductPreview,
  Review,
  Variant,
} from '@/lib/catalog/schemas';

/**
 * Test data shaped like product-service responses, for component and SEO unit
 * tests. The running app always reads the catalog from the API.
 */

const CURRENCY: Currency = 'EUR';
const eur = (amount: number): Money => ({ amount: Math.round(amount * 100), currency: CURRENCY });

let sequence = 0;
/** Deterministic RFC 4122-shaped IDs so fixtures are stable between renders. */
function uid(namespace: number): string {
  sequence += 1;
  const tail = (namespace * 10_000 + sequence).toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${tail}`;
}

// ── Colorways ───────────────────────────────────────────────────────────────
const COLORWAYS = {
  carbon: {
    label: 'Carbon',
    swatch: '#2a2c31',
    preview: {
      caseColor: '#2a2c31',
      keyColor: '#3b3e45',
      accentColor: '#c8743f',
      legendColor: '#d9d4ca',
    },
  },
  chalk: {
    label: 'Chalk',
    swatch: '#e6e1d8',
    preview: {
      caseColor: '#e6e1d8',
      keyColor: '#f6f3ec',
      accentColor: '#c8743f',
      legendColor: '#45474d',
    },
  },
  silver: {
    label: 'Anodised Silver',
    swatch: '#b8bbc0',
    preview: {
      caseColor: '#b8bbc0',
      keyColor: '#ebe9e4',
      accentColor: '#2f6f8f',
      legendColor: '#33363b',
    },
  },
  sage: {
    label: 'Sage',
    swatch: '#9aa894',
    preview: {
      caseColor: '#9aa894',
      keyColor: '#eef0e8',
      accentColor: '#5d7356',
      legendColor: '#39402f',
    },
  },
  navy: {
    label: 'Deep Navy',
    swatch: '#24324a',
    preview: {
      caseColor: '#24324a',
      keyColor: '#dfe3ea',
      accentColor: '#e0a050',
      legendColor: '#24324a',
    },
  },
} as const;
type Colorway = keyof typeof COLORWAYS;

const SWITCHES = {
  linear: { label: 'Silk Linear', hint: 'Smooth, 45 gf', type: 'Linear' },
  tactile: { label: 'Ember Tactile', hint: 'Rounded bump, 55 gf', type: 'Tactile' },
  clicky: { label: 'Crisp Clicky', hint: 'Click bar, 60 gf', type: 'Clicky' },
} as const;
type SwitchKey = keyof typeof SWITCHES;

function preview(kind: ProductKind, colorway: Colorway, layout?: KeyboardLayout): ProductPreview {
  return { kind, ...(layout ? { layout } : {}), ...COLORWAYS[colorway].preview };
}

function colorOption(colorways: readonly Colorway[]): ProductOption {
  return {
    key: 'color',
    name: 'Color',
    display: 'swatch',
    values: colorways.map((c) => ({
      value: c,
      label: COLORWAYS[c].label,
      swatch: COLORWAYS[c].swatch,
    })),
  };
}

function switchOption(switches: readonly SwitchKey[]): ProductOption {
  return {
    key: 'switch',
    name: 'Switch',
    display: 'pill',
    values: switches.map((s) => ({ value: s, label: SWITCHES[s].label, hint: SWITCHES[s].hint })),
  };
}

function lowest(variants: Variant[]): Variant {
  return variants.reduce((min, v) => (v.price.amount < min.price.amount ? v : min));
}

function rollupAvailability(variants: Variant[]): Availability {
  if (variants.some((v) => v.availability === 'IN_STOCK')) return 'IN_STOCK';
  if (variants.some((v) => v.availability === 'LOW_STOCK')) return 'LOW_STOCK';
  if (variants.some((v) => v.availability === 'PREORDER')) return 'PREORDER';
  return 'OUT_OF_STOCK';
}

const SHARED_KEYBOARD_FAQ = [
  {
    question: 'Can I change the switches later?',
    answer:
      'Yes. Every CSE board uses hot-swappable sockets that accept 3- and 5-pin MX-style switches, so you can swap switches without soldering. A switch puller is in the box.',
  },
  {
    question: 'Does it work with macOS, Windows and Linux?',
    answer:
      'Yes. The board ships with dedicated Mac and Windows keycaps and a hardware toggle. Linux works out of the box as a standard HID keyboard.',
  },
  {
    question: 'How do I remap keys?',
    answer:
      'Firmware is QMK-based with VIA support, so you can remap keys, layers and macros from your browser — no drivers or account required.',
  },
];

interface KeyboardInput {
  ns: number;
  slug: string;
  name: string;
  tagline: string;
  layout: KeyboardLayout;
  mount: string;
  caseMaterial: string;
  plate: string;
  connection: 'Wired' | 'Tri-mode' | 'Wired + 2.4GHz';
  battery?: string;
  weight: string;
  dimensions: string;
  basePrice: number;
  compareAt?: number;
  /** Price delta per colorway (premium finishes cost more). */
  colorways: Partial<Record<Colorway, number>>;
  switches: readonly SwitchKey[];
  badges: Badge[];
  rating: [number, number];
  createdAt: string;
  outOfStock?: string[];
  lowStock?: string[];
  description: string[];
  highlights: string[];
}

function keyboard(input: KeyboardInput): Product {
  const colorways = Object.keys(input.colorways) as Colorway[];
  const variants: Variant[] = [];
  for (const color of colorways) {
    for (const sw of input.switches) {
      const key = `${color}/${sw}`;
      const price = input.basePrice + (input.colorways[color] ?? 0);
      variants.push({
        id: uid(input.ns),
        sku: `CSE-${input.slug.replace(/^cse-/, '').toUpperCase()}-${color.slice(0, 3).toUpperCase()}-${sw.slice(0, 3).toUpperCase()}`,
        options: { color, switch: sw },
        price: eur(price),
        compareAtPrice: input.compareAt
          ? eur(input.compareAt + (input.colorways[color] ?? 0))
          : null,
        availability: input.outOfStock?.includes(key)
          ? 'OUT_OF_STOCK'
          : input.lowStock?.includes(key)
            ? 'LOW_STOCK'
            : 'IN_STOCK',
        preview: preview('keyboard', color, input.layout),
        images: [],
      });
    }
  }
  const from = lowest(variants);
  const wireless = input.connection !== 'Wired';
  return {
    id: uid(input.ns),
    slug: input.slug,
    name: input.name,
    brand: 'CSE',
    categorySlug: 'keyboards',
    kind: 'keyboard',
    tagline: input.tagline,
    price: from.price,
    compareAtPrice: from.compareAtPrice,
    rating: { average: input.rating[0], count: input.rating[1] },
    badges: input.badges,
    availability: rollupAvailability(variants),
    attributes: {
      brand: ['CSE'],
      layout: [input.layout],
      switchType: input.switches.map((s) => SWITCHES[s].type),
      connection: [input.connection],
      mount: [input.mount],
      material: [input.caseMaterial],
    },
    images: [],
    preview: from.preview,
    createdAt: input.createdAt,
    description: input.description,
    highlights: input.highlights,
    options: [colorOption(colorways), switchOption(input.switches)],
    variants,
    specs: [
      {
        group: 'Build',
        items: [
          { label: 'Layout', value: input.layout },
          { label: 'Mounting style', value: input.mount },
          { label: 'Case', value: input.caseMaterial },
          { label: 'Plate', value: input.plate },
          { label: 'PCB', value: 'Hot-swappable, 3/5-pin, south-facing RGB' },
          { label: 'Stabilizers', value: 'PCB screw-in, factory lubed' },
          { label: 'Firmware', value: 'QMK with VIA support' },
        ],
      },
      {
        group: 'Connectivity',
        items: [
          { label: 'Wired', value: 'USB-C (detachable)' },
          {
            label: 'Bluetooth',
            value: input.connection === 'Tri-mode' ? 'Bluetooth 5.1, 3 devices' : '—',
          },
          { label: '2.4GHz', value: wireless ? '1000 Hz receiver included' : '—' },
          { label: 'Battery', value: input.battery ?? '—' },
        ],
      },
      {
        group: 'Typing',
        items: [
          { label: 'Keycaps', value: 'Double-shot PBT, Cherry profile' },
          { label: 'Keycap compatibility', value: 'MX-style stems, standard bottom row' },
          { label: 'Switch compatibility', value: 'MX-style 3-pin and 5-pin' },
          { label: 'RGB', value: 'Per-key, south-facing' },
        ],
      },
      {
        group: 'Physical',
        items: [
          { label: 'Weight', value: input.weight },
          { label: 'Dimensions', value: input.dimensions },
        ],
      },
    ],
    included: [
      `${input.name} keyboard`,
      'Braided USB-C to USB-A cable',
      ...(wireless ? ['2.4GHz receiver + extension adapter'] : []),
      'Switch and keycap puller',
      'Mac & Windows replacement keycaps',
      'Quick-start card',
    ],
    compatibility: [
      'macOS, Windows, Linux, iPadOS, Android',
      'All MX-style switches (3-pin and 5-pin)',
      'Cherry and OEM profile keycap sets with a standard bottom row',
    ],
    faq: SHARED_KEYBOARD_FAQ,
  };
}

interface SimpleInput {
  ns: number;
  slug: string;
  name: string;
  brand: string;
  categorySlug: string;
  kind: ProductKind;
  tagline: string;
  colorway: Colorway;
  option: ProductOption;
  /** Price per option value. */
  prices: Record<string, number>;
  compareAt?: Record<string, number>;
  attributes: Record<string, string[]>;
  badges: Badge[];
  rating: [number, number];
  createdAt: string;
  description: string[];
  highlights: string[];
  specs: Product['specs'];
  included: string[];
  compatibility: string[];
  faq?: Product['faq'];
}

function simpleProduct(input: SimpleInput): Product {
  const variants: Variant[] = input.option.values.map((value) => ({
    id: uid(input.ns),
    sku: `CSE-${input.slug.toUpperCase()}-${value.value.toUpperCase()}`.replace(/[^A-Z0-9-]/g, ''),
    options: { [input.option.key]: value.value },
    price: eur(input.prices[value.value] ?? 0),
    compareAtPrice: input.compareAt?.[value.value] ? eur(input.compareAt[value.value] ?? 0) : null,
    availability: 'IN_STOCK',
    preview: preview(input.kind, input.colorway),
    images: [],
  }));
  const from = lowest(variants);
  return {
    id: uid(input.ns),
    slug: input.slug,
    name: input.name,
    brand: input.brand,
    categorySlug: input.categorySlug,
    kind: input.kind,
    tagline: input.tagline,
    price: from.price,
    compareAtPrice: from.compareAtPrice,
    rating: { average: input.rating[0], count: input.rating[1] },
    badges: input.badges,
    availability: rollupAvailability(variants),
    attributes: { brand: [input.brand], ...input.attributes },
    images: [],
    preview: from.preview,
    createdAt: input.createdAt,
    description: input.description,
    highlights: input.highlights,
    options: [input.option],
    variants,
    specs: input.specs,
    included: input.included,
    compatibility: input.compatibility,
    faq: input.faq ?? [],
  };
}

// ── Categories ──────────────────────────────────────────────────────────────
export const categories: Category[] = [
  {
    slug: 'keyboards',
    name: 'Keyboards',
    description:
      'Assembled, tuned and ready to type. Gasket and top-mount boards from 60% to full size.',
    parentSlug: null,
    kind: 'keyboard' as const,
    colorway: 'carbon' as const,
    layout: '75%' as const,
  },
  {
    slug: 'switches',
    name: 'Switches',
    description: 'Linear, tactile and clicky switches, factory lubed and tested in-house.',
    parentSlug: null,
    kind: 'switch' as const,
    colorway: 'chalk' as const,
  },
  {
    slug: 'keycaps',
    name: 'Keycaps',
    description: 'Double-shot PBT and ABS sets in Cherry and OEM profiles.',
    parentSlug: null,
    kind: 'keycaps' as const,
    colorway: 'navy' as const,
  },
  {
    slug: 'accessories',
    name: 'Accessories',
    description: 'Everything around the board: stabilizers, cables, desk mats and wrist rests.',
    parentSlug: null,
    kind: 'deskmat' as const,
    colorway: 'sage' as const,
  },
  {
    slug: 'stabilizers',
    name: 'Stabilizers',
    description: 'Screw-in stabilizers for a rattle-free spacebar.',
    parentSlug: 'accessories',
    kind: 'stabilizer' as const,
    colorway: 'carbon' as const,
  },
  {
    slug: 'cables',
    name: 'Cables',
    description: 'Coiled and straight USB-C cables with aviator connectors.',
    parentSlug: 'accessories',
    kind: 'cable' as const,
    colorway: 'navy' as const,
  },
  {
    slug: 'desk-mats',
    name: 'Desk mats',
    description: 'Stitched-edge desk mats sized for every layout.',
    parentSlug: 'accessories',
    kind: 'deskmat' as const,
    colorway: 'chalk' as const,
  },
  {
    slug: 'wrist-rests',
    name: 'Wrist rests',
    description: 'Solid hardwood and resin wrist rests matched to board sizes.',
    parentSlug: 'accessories',
    kind: 'wristrest' as const,
    colorway: 'carbon' as const,
  },
].map(({ kind, colorway, layout, ...category }) => ({
  ...category,
  id: uid(1),
  preview: preview(kind, colorway, layout),
}));

// ── Products ────────────────────────────────────────────────────────────────
export const products: Product[] = [
  keyboard({
    ns: 2,
    slug: 'cse-forge-75',
    name: 'CSE Forge 75',
    tagline: 'Gasket-mounted 75% in CNC aluminium',
    layout: '75%',
    mount: 'Gasket',
    caseMaterial: 'Aluminium',
    plate: 'FR4',
    connection: 'Tri-mode',
    battery: '4000 mAh',
    weight: '1.9 kg',
    dimensions: '327 × 140 × 34 mm',
    basePrice: 189,
    colorways: { carbon: 0, chalk: 0, silver: 20 },
    switches: ['linear', 'tactile', 'clicky'],
    badges: ['BESTSELLER'],
    rating: [4.8, 412],
    createdAt: '2026-03-02T09:00:00.000Z',
    lowStock: ['silver/clicky'],
    outOfStock: ['chalk/clicky'],
    description: [
      'The Forge 75 is the board we would build for ourselves: a 75% layout milled from a single block of 6063 aluminium, suspended on silicone gaskets for a soft, even bottom-out across the whole board.',
      'Five layers of acoustic foam and a tuned FR4 plate remove hollowness and ping, so every keystroke lands with a deep, rounded sound. Switch to Bluetooth or 2.4GHz in a second and keep typing for weeks on one charge.',
    ],
    highlights: [
      'Gasket mount with flex-cut FR4 plate',
      'Tri-mode: USB-C, Bluetooth 5.1, 2.4GHz',
      'Hot-swappable south-facing PCB',
      'Five-layer acoustic dampening',
    ],
  }),
  keyboard({
    ns: 3,
    slug: 'cse-atlas-tkl',
    name: 'CSE Atlas TKL',
    tagline: 'Top-mount tenkeyless with a brass weight',
    layout: 'TKL',
    mount: 'Top mount',
    caseMaterial: 'Aluminium',
    plate: 'Aluminium',
    connection: 'Wired',
    weight: '2.4 kg',
    dimensions: '360 × 140 × 36 mm',
    basePrice: 229,
    colorways: { silver: 0, carbon: 0, navy: 15 },
    switches: ['linear', 'tactile'],
    badges: ['NEW'],
    rating: [4.9, 87],
    createdAt: '2026-09-18T09:00:00.000Z',
    description: [
      'Atlas is a wired tenkeyless with a top-mount aluminium plate for a firm, precise feel and a mirror-polished brass weight that anchors it to your desk.',
      'A 8000 Hz polling rate and a dedicated function row make it equally at home in a code editor and in competitive games.',
    ],
    highlights: [
      'Top-mount aluminium plate',
      'Polished brass weight',
      '8000 Hz polling',
      'Hot-swappable PCB',
    ],
  }),
  keyboard({
    ns: 4,
    slug: 'cse-nimbus-65',
    name: 'CSE Nimbus 65',
    tagline: 'Translucent polycarbonate 65% with soft gasket feel',
    layout: '65%',
    mount: 'Gasket',
    caseMaterial: 'Polycarbonate',
    plate: 'Polycarbonate',
    connection: 'Tri-mode',
    battery: '3000 mAh',
    weight: '1.1 kg',
    dimensions: '318 × 108 × 32 mm',
    basePrice: 149,
    compareAt: 169,
    colorways: { chalk: 0, sage: 0, navy: 0 },
    switches: ['linear', 'tactile'],
    badges: ['SALE'],
    rating: [4.7, 268],
    createdAt: '2026-05-14T09:00:00.000Z',
    description: [
      'Nimbus pairs a frosted polycarbonate case with a PC plate for the softest, most forgiving typing feel in our range — perfect for long writing sessions.',
      'Per-key RGB glows through the whole case, and tri-mode wireless keeps your desk free of cables.',
    ],
    highlights: [
      'Frosted polycarbonate case',
      'Flexible PC plate',
      'Tri-mode wireless',
      'Arrow keys in a compact 65%',
    ],
  }),
  keyboard({
    ns: 5,
    slug: 'cse-pulse-60',
    name: 'CSE Pulse 60',
    tagline: 'A compact 60% to start your build',
    layout: '60%',
    mount: 'Tray mount',
    caseMaterial: 'ABS',
    plate: 'Steel',
    connection: 'Wired',
    weight: '0.7 kg',
    dimensions: '295 × 103 × 30 mm',
    basePrice: 99,
    colorways: { carbon: 0, chalk: 0 },
    switches: ['linear', 'tactile', 'clicky'],
    badges: [],
    rating: [4.5, 531],
    createdAt: '2025-11-20T09:00:00.000Z',
    description: [
      'Pulse 60 is the most affordable way into the CSE ecosystem: the same hot-swap PCB, tuned stabilizers and PBT keycaps as our flagship boards, in a light, portable 60% case.',
    ],
    highlights: [
      'Portable 60% layout',
      'Hot-swappable PCB',
      'Pre-lubed stabilizers',
      'Double-shot PBT keycaps',
    ],
  }),
  keyboard({
    ns: 6,
    slug: 'cse-orbit-96',
    name: 'CSE Orbit 96',
    tagline: 'Full numpad in a compact 96% footprint',
    layout: '96%',
    mount: 'Gasket',
    caseMaterial: 'Aluminium',
    plate: 'Aluminium',
    connection: 'Tri-mode',
    battery: '5000 mAh',
    weight: '2.1 kg',
    dimensions: '385 × 135 × 34 mm',
    basePrice: 199,
    colorways: { silver: 0, carbon: 0, sage: 10 },
    switches: ['linear', 'tactile'],
    badges: [],
    rating: [4.6, 154],
    createdAt: '2026-01-25T09:00:00.000Z',
    description: [
      'Orbit 96 keeps the numpad you need for spreadsheets while saving a full hand-width of desk space compared to a full-size board.',
    ],
    highlights: ['96% layout with numpad', 'Gasket mount', 'Tri-mode wireless', '5000 mAh battery'],
  }),
  keyboard({
    ns: 7,
    slug: 'cse-summit-100',
    name: 'CSE Summit 100',
    tagline: 'Full-size, full-feature, low-latency',
    layout: '100%',
    mount: 'Top mount',
    caseMaterial: 'Aluminium',
    plate: 'Aluminium',
    connection: 'Wired + 2.4GHz',
    battery: '4000 mAh',
    weight: '2.6 kg',
    dimensions: '440 × 140 × 36 mm',
    basePrice: 219,
    colorways: { carbon: 0, silver: 0 },
    switches: ['linear', 'tactile', 'clicky'],
    badges: ['LIMITED'],
    rating: [4.7, 96],
    createdAt: '2026-07-08T09:00:00.000Z',
    outOfStock: ['silver/clicky', 'silver/tactile'],
    description: [
      'A full-size board for people who use every key. Summit adds a programmable volume knob and a low-latency 2.4GHz mode tuned for gaming.',
    ],
    highlights: [
      'Full-size layout',
      'Programmable knob',
      'Low-latency 2.4GHz',
      'Limited production run',
    ],
  }),
  simpleProduct({
    ns: 8,
    slug: 'cse-silk-linear',
    name: 'Silk Linear Switches',
    brand: 'CSE Labs',
    categorySlug: 'switches',
    kind: 'switch',
    tagline: '45 gf linear, factory lubed',
    colorway: 'chalk',
    option: {
      key: 'pack',
      name: 'Pack size',
      display: 'pill',
      values: [
        { value: '35', label: '35 switches' },
        { value: '70', label: '70 switches' },
        { value: '90', label: '90 switches' },
      ],
    },
    prices: { '35': 19, '70': 35, '90': 42 },
    attributes: { switchType: ['Linear'] },
    badges: ['BESTSELLER'],
    rating: [4.8, 903],
    createdAt: '2025-10-01T09:00:00.000Z',
    description: [
      'Silk is a smooth linear switch with a long-pole stem, POM housing and a light factory lube that keeps the stroke silky without dulling the sound.',
    ],
    highlights: [
      '45 gf actuation, 55 gf bottom-out',
      'Long-pole POM stem',
      'Factory lubed',
      '5-pin',
    ],
    specs: [
      {
        group: 'Switch',
        items: [
          { label: 'Type', value: 'Linear' },
          { label: 'Actuation force', value: '45 gf' },
          { label: 'Total travel', value: '3.5 mm' },
          { label: 'Pins', value: '5-pin' },
          { label: 'Housing', value: 'PC top, nylon bottom' },
        ],
      },
    ],
    included: ['Switches in a resealable tray'],
    compatibility: ['Any hot-swap PCB with MX-style sockets (3- or 5-pin)'],
  }),
  simpleProduct({
    ns: 9,
    slug: 'cse-ember-tactile',
    name: 'Ember Tactile Switches',
    brand: 'CSE Labs',
    categorySlug: 'switches',
    kind: 'switch',
    tagline: 'Rounded tactile bump, 55 gf',
    colorway: 'carbon',
    option: {
      key: 'pack',
      name: 'Pack size',
      display: 'pill',
      values: [
        { value: '35', label: '35 switches' },
        { value: '70', label: '70 switches' },
        { value: '90', label: '90 switches' },
      ],
    },
    prices: { '35': 21, '70': 38, '90': 46 },
    attributes: { switchType: ['Tactile'] },
    badges: ['NEW'],
    rating: [4.7, 211],
    createdAt: '2026-08-30T09:00:00.000Z',
    description: [
      'Ember delivers a rounded, pronounced bump at the very top of the stroke with no pre-travel.',
    ],
    highlights: ['55 gf tactile bump', 'No pre-travel', 'Factory lubed spring', '5-pin'],
    specs: [
      {
        group: 'Switch',
        items: [
          { label: 'Type', value: 'Tactile' },
          { label: 'Actuation force', value: '55 gf' },
          { label: 'Total travel', value: '4.0 mm' },
          { label: 'Pins', value: '5-pin' },
        ],
      },
    ],
    included: ['Switches in a resealable tray'],
    compatibility: ['Any hot-swap PCB with MX-style sockets (3- or 5-pin)'],
  }),
  simpleProduct({
    ns: 10,
    slug: 'cse-crisp-clicky',
    name: 'Crisp Clicky Switches',
    brand: 'CSE Labs',
    categorySlug: 'switches',
    kind: 'switch',
    tagline: 'Click bar for a sharp, consistent click',
    colorway: 'navy',
    option: {
      key: 'pack',
      name: 'Pack size',
      display: 'pill',
      values: [
        { value: '35', label: '35 switches' },
        { value: '70', label: '70 switches' },
      ],
    },
    prices: { '35': 19, '70': 35 },
    attributes: { switchType: ['Clicky'] },
    badges: [],
    rating: [4.4, 148],
    createdAt: '2025-12-05T09:00:00.000Z',
    description: [
      'A click-bar mechanism gives a crisp, high-pitched click on the way down and a clean return.',
    ],
    highlights: ['Click-bar mechanism', '60 gf', '5-pin'],
    specs: [
      {
        group: 'Switch',
        items: [
          { label: 'Type', value: 'Clicky' },
          { label: 'Actuation force', value: '60 gf' },
          { label: 'Pins', value: '5-pin' },
        ],
      },
    ],
    included: ['Switches in a resealable tray'],
    compatibility: ['Any hot-swap PCB with MX-style sockets (3- or 5-pin)'],
  }),
  simpleProduct({
    ns: 11,
    slug: 'paper-and-ink-pbt-keycaps',
    name: 'Paper & Ink PBT Keycaps',
    brand: 'CSE',
    categorySlug: 'keycaps',
    kind: 'keycaps',
    tagline: 'Double-shot PBT, Cherry profile',
    colorway: 'chalk',
    option: {
      key: 'kit',
      name: 'Kit',
      display: 'pill',
      values: [
        { value: 'base', label: 'Base kit', hint: '143 keys' },
        { value: 'full', label: 'Base + numpad + novelties', hint: '210 keys' },
      ],
    },
    prices: { base: 79, full: 109 },
    attributes: { profile: ['Cherry'], material: ['PBT'] },
    badges: ['BESTSELLER'],
    rating: [4.9, 377],
    createdAt: '2026-02-10T09:00:00.000Z',
    description: [
      'Warm off-white alphas with deep graphite legends: a calm, timeless set that suits every board.',
    ],
    highlights: ['1.5 mm double-shot PBT', 'Cherry profile', 'Covers 60% to 100% layouts'],
    specs: [
      {
        group: 'Keycaps',
        items: [
          { label: 'Material', value: 'PBT, 1.5 mm walls' },
          { label: 'Legends', value: 'Double-shot' },
          { label: 'Profile', value: 'Cherry' },
        ],
      },
    ],
    included: ['Keycaps', 'Keycap puller'],
    compatibility: ['MX-style switches', 'Standard and most 75%/65% layouts'],
  }),
  simpleProduct({
    ns: 12,
    slug: 'copper-dusk-keycaps',
    name: 'Copper Dusk Keycaps',
    brand: 'CSE',
    categorySlug: 'keycaps',
    kind: 'keycaps',
    tagline: 'Graphite and copper, dye-sub PBT',
    colorway: 'carbon',
    option: {
      key: 'kit',
      name: 'Kit',
      display: 'pill',
      values: [{ value: 'base', label: 'Base kit', hint: '139 keys' }],
    },
    prices: { base: 69 },
    compareAt: { base: 85 },
    attributes: { profile: ['Cherry'], material: ['PBT'] },
    badges: ['SALE'],
    rating: [4.6, 122],
    createdAt: '2026-06-01T09:00:00.000Z',
    description: [
      'Graphite alphas with copper accents and dye-sublimated legends that never fade.',
    ],
    highlights: ['Dye-sub PBT', 'Cherry profile', 'Copper accent keys'],
    specs: [
      {
        group: 'Keycaps',
        items: [
          { label: 'Material', value: 'PBT' },
          { label: 'Profile', value: 'Cherry' },
        ],
      },
    ],
    included: ['Keycaps', 'Keycap puller'],
    compatibility: ['MX-style switches'],
  }),
  simpleProduct({
    ns: 13,
    slug: 'midnight-mono-abs-keycaps',
    name: 'Midnight Mono ABS Keycaps',
    brand: 'CSE',
    categorySlug: 'keycaps',
    kind: 'keycaps',
    tagline: 'Glossy double-shot ABS, OEM profile',
    colorway: 'navy',
    option: {
      key: 'kit',
      name: 'Kit',
      display: 'pill',
      values: [{ value: 'base', label: 'Base kit', hint: '129 keys' }],
    },
    prices: { base: 59 },
    attributes: { profile: ['OEM'], material: ['ABS'] },
    badges: [],
    rating: [4.3, 64],
    createdAt: '2026-04-11T09:00:00.000Z',
    description: ['Crisp double-shot ABS with razor-sharp legends and a deep, poppy sound.'],
    highlights: ['Double-shot ABS', 'OEM profile'],
    specs: [
      {
        group: 'Keycaps',
        items: [
          { label: 'Material', value: 'ABS' },
          { label: 'Profile', value: 'OEM' },
        ],
      },
    ],
    included: ['Keycaps'],
    compatibility: ['MX-style switches'],
  }),
  simpleProduct({
    ns: 14,
    slug: 'cse-screw-in-stabilizers',
    name: 'Screw-in Stabilizers',
    brand: 'CSE Labs',
    categorySlug: 'stabilizers',
    kind: 'stabilizer',
    tagline: 'Pre-lubed, rattle-free PCB stabilizers',
    colorway: 'carbon',
    option: {
      key: 'set',
      name: 'Set',
      display: 'pill',
      values: [
        { value: 'tkl', label: '60%–TKL set', hint: '4× 2u + 1× 6.25u' },
        { value: 'full', label: 'Full-size set', hint: '7× 2u + 1× 6.25u' },
      ],
    },
    prices: { tkl: 22, full: 29 },
    attributes: {},
    badges: [],
    rating: [4.8, 189],
    createdAt: '2026-01-05T09:00:00.000Z',
    description: [
      'Gold-plated wires, tight-tolerance housings and factory lube for a quiet, even spacebar.',
    ],
    highlights: ['Gold-plated wires', 'Factory lubed', 'Screw-in'],
    specs: [{ group: 'Stabilizers', items: [{ label: 'Mount', value: 'PCB screw-in' }] }],
    included: ['Stabilizers', 'Screws and washers'],
    compatibility: ['PCBs with screw-in stabilizer holes'],
  }),
  simpleProduct({
    ns: 15,
    slug: 'coiled-aviator-cable',
    name: 'Coiled Aviator Cable',
    brand: 'CSE',
    categorySlug: 'cables',
    kind: 'cable',
    tagline: 'USB-C coiled cable with aviator connector',
    colorway: 'navy',
    option: {
      key: 'color',
      name: 'Color',
      display: 'swatch',
      values: [
        { value: 'navy', label: 'Deep Navy', swatch: '#24324a' },
        { value: 'carbon', label: 'Carbon', swatch: '#2a2c31' },
        { value: 'chalk', label: 'Chalk', swatch: '#e6e1d8' },
      ],
    },
    prices: { navy: 39, carbon: 39, chalk: 39 },
    attributes: {},
    badges: [],
    rating: [4.7, 245],
    createdAt: '2026-02-20T09:00:00.000Z',
    description: ['A double-sleeved coiled cable with a detachable 5-pin aviator connector.'],
    highlights: ['USB-C to USB-A', '1.8 m total length', 'Aviator connector'],
    specs: [
      {
        group: 'Cable',
        items: [
          { label: 'Length', value: '1.8 m' },
          { label: 'Connector', value: 'USB-C' },
        ],
      },
    ],
    included: ['Cable', 'USB-C adapter'],
    compatibility: ['Any USB-C keyboard'],
  }),
  simpleProduct({
    ns: 16,
    slug: 'contour-desk-mat',
    name: 'Contour Desk Mat',
    brand: 'CSE',
    categorySlug: 'desk-mats',
    kind: 'deskmat',
    tagline: 'Stitched edges, topographic print',
    colorway: 'sage',
    option: {
      key: 'size',
      name: 'Size',
      display: 'pill',
      values: [
        { value: 'm', label: '700 × 300 mm' },
        { value: 'l', label: '900 × 400 mm' },
      ],
    },
    prices: { m: 25, l: 32 },
    attributes: {},
    badges: ['NEW'],
    rating: [4.8, 58],
    createdAt: '2026-09-02T09:00:00.000Z',
    description: [
      'A smooth cloth surface on natural rubber with a subtle topographic print and stitched edges.',
    ],
    highlights: ['4 mm natural rubber base', 'Stitched edges', 'Water-resistant coating'],
    specs: [{ group: 'Desk mat', items: [{ label: 'Thickness', value: '4 mm' }] }],
    included: ['Desk mat'],
    compatibility: ['Any desk setup'],
  }),
  simpleProduct({
    ns: 17,
    slug: 'walnut-wrist-rest',
    name: 'Walnut Wrist Rest',
    brand: 'CSE',
    categorySlug: 'wrist-rests',
    kind: 'wristrest',
    tagline: 'Solid American walnut, oil finish',
    colorway: 'carbon',
    option: {
      key: 'size',
      name: 'Size',
      display: 'pill',
      values: [
        { value: '65', label: '60% / 65%' },
        { value: '75', label: '75%' },
        { value: 'tkl', label: 'TKL' },
        { value: 'full', label: 'Full size' },
      ],
    },
    prices: { '65': 45, '75': 49, tkl: 55, full: 62 },
    attributes: {},
    badges: [],
    rating: [4.9, 141],
    createdAt: '2025-12-15T09:00:00.000Z',
    description: ['Machined from solid walnut with a gentle slope and non-slip feet.'],
    highlights: ['Solid American walnut', 'Natural oil finish', 'Non-slip feet'],
    specs: [
      {
        group: 'Wrist rest',
        items: [
          { label: 'Material', value: 'Walnut' },
          { label: 'Height', value: '18 mm' },
        ],
      },
    ],
    included: ['Wrist rest'],
    compatibility: ['Matched to CSE board sizes'],
  }),
];

/** Curated slugs for the homepage hero/featured rail (merchandising data from the CMS later). */
export const featuredSlugs = ['cse-forge-75', 'cse-atlas-tkl', 'cse-nimbus-65', 'cse-orbit-96'];

export const reviews: Review[] = [
  {
    author: 'Andrei P.',
    rating: 5,
    title: 'Best typing feel I have owned',
    body: 'The Forge 75 sounds deep and muted out of the box. I did not have to mod anything.',
    productName: 'CSE Forge 75',
    createdAt: '2026-09-21T10:00:00.000Z',
  },
  {
    author: 'Maria L.',
    rating: 5,
    title: 'Wireless that actually works',
    body: 'Switching between my laptop and desktop is instant and the battery lasts weeks.',
    productName: 'CSE Nimbus 65',
    createdAt: '2026-09-12T10:00:00.000Z',
  },
  {
    author: 'Tudor C.',
    rating: 5,
    title: 'Silk switches are buttery',
    body: 'Smooth, consistent and no scratch at all. Already ordered a second pack.',
    productName: 'Silk Linear Switches',
    createdAt: '2026-08-30T10:00:00.000Z',
  },
  {
    author: 'Elena R.',
    rating: 4,
    title: 'Gorgeous keycaps',
    body: 'Paper & Ink looks even better in person. Legends are sharp.',
    productName: 'Paper & Ink PBT Keycaps',
    createdAt: '2026-08-18T10:00:00.000Z',
  },
  {
    author: 'Vlad M.',
    rating: 5,
    title: 'Fast shipping, perfect packaging',
    body: 'Arrived in two days, double-boxed, with every accessory listed.',
    productName: 'CSE Atlas TKL',
    createdAt: '2026-09-27T10:00:00.000Z',
  },
  {
    author: 'Ioana S.',
    rating: 5,
    title: 'Great first custom board',
    body: 'Pulse 60 was easy to set up in VIA and the stabilizers do not rattle.',
    productName: 'CSE Pulse 60',
    createdAt: '2026-07-04T10:00:00.000Z',
  },
].map((review) => ({ ...review, id: uid(18), verifiedPurchase: true }));
