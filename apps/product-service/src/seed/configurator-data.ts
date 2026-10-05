import type { ConfiguratorGroup, ProductPreview } from '@market/types';

interface OptionSeed {
  group: ConfiguratorGroup;
  value: string;
  label: string;
  description?: string;
  priceDeltaAmount: number;
  skuCode: string;
  swatch?: string;
  preview?: Partial<ProductPreview>;
  isDefault?: boolean;
  available?: boolean;
}

/** The "build your own" keyboard. Base price = cheapest combination; options add surcharges. */
export const CSE_CUSTOM = {
  slug: 'cse-custom',
  name: 'CSE Custom',
  description:
    'Choose every part of your board. We assemble, lube and sound-test it before it ships.',
  skuPrefix: 'CSE-CFG',
  basePrice: 129_00,
  basePreview: {
    kind: 'keyboard',
    layout: '75%',
    caseColor: '#2a2c31',
    keyColor: '#3b3e45',
    accentColor: '#c8743f',
    legendColor: '#d9d4ca',
  } satisfies ProductPreview,
  options: [
    {
      group: 'layout',
      value: '60',
      label: '60%',
      priceDeltaAmount: 0,
      skuCode: '60',
      preview: { layout: '60%' },
    },
    {
      group: 'layout',
      value: '65',
      label: '65%',
      priceDeltaAmount: 10_00,
      skuCode: '65',
      preview: { layout: '65%' },
    },
    {
      group: 'layout',
      value: '75',
      label: '75%',
      priceDeltaAmount: 20_00,
      skuCode: '75',
      preview: { layout: '75%' },
      isDefault: true,
    },
    {
      group: 'layout',
      value: 'tkl',
      label: 'TKL',
      priceDeltaAmount: 30_00,
      skuCode: 'TKL',
      preview: { layout: 'TKL' },
    },
    {
      group: 'layout',
      value: '96',
      label: '96%',
      priceDeltaAmount: 40_00,
      skuCode: '96',
      preview: { layout: '96%' },
    },
    {
      group: 'layout',
      value: '100',
      label: '100%',
      priceDeltaAmount: 45_00,
      skuCode: '100',
      preview: { layout: '100%' },
    },

    {
      group: 'case',
      value: 'black',
      label: 'Black',
      priceDeltaAmount: 0,
      skuCode: 'BLK',
      swatch: '#2a2c31',
      preview: { caseColor: '#2a2c31' },
      isDefault: true,
    },
    {
      group: 'case',
      value: 'white',
      label: 'White',
      priceDeltaAmount: 0,
      skuCode: 'WHT',
      swatch: '#e6e1d8',
      preview: { caseColor: '#e6e1d8' },
    },
    {
      group: 'case',
      value: 'silver',
      label: 'Silver',
      description: 'Bead-blasted, anodised',
      priceDeltaAmount: 15_00,
      skuCode: 'SLV',
      swatch: '#b8bbc0',
      preview: { caseColor: '#b8bbc0' },
    },

    {
      group: 'switch',
      value: 'linear',
      label: 'Linear',
      description: 'Silk Linear, 45 gf',
      priceDeltaAmount: 0,
      skuCode: 'LIN',
      isDefault: true,
    },
    {
      group: 'switch',
      value: 'tactile',
      label: 'Tactile',
      description: 'Ember Tactile, 55 gf',
      priceDeltaAmount: 5_00,
      skuCode: 'TAC',
    },
    {
      group: 'switch',
      value: 'clicky',
      label: 'Clicky',
      description: 'Crisp Clicky, 60 gf',
      priceDeltaAmount: 0,
      skuCode: 'CLK',
    },

    {
      group: 'plate',
      value: 'aluminum',
      label: 'Aluminum',
      description: 'Firm, precise',
      priceDeltaAmount: 0,
      skuCode: 'ALU',
      isDefault: true,
    },
    {
      group: 'plate',
      value: 'fr4',
      label: 'FR4',
      description: 'Balanced flex',
      priceDeltaAmount: 0,
      skuCode: 'FR4',
    },
    {
      group: 'plate',
      value: 'polycarbonate',
      label: 'Polycarbonate',
      description: 'Soft, deep sound',
      priceDeltaAmount: 5_00,
      skuCode: 'PC',
    },

    {
      group: 'keycaps',
      value: 'abs',
      label: 'ABS',
      description: 'Double-shot, glossy',
      priceDeltaAmount: 0,
      skuCode: 'ABS',
      preview: { keyColor: '#3b3e45', legendColor: '#d9d4ca' },
    },
    {
      group: 'keycaps',
      value: 'pbt',
      label: 'PBT',
      description: 'Double-shot, textured',
      priceDeltaAmount: 10_00,
      skuCode: 'PBT',
      preview: { keyColor: '#f6f3ec', legendColor: '#45474d' },
      isDefault: true,
    },

    {
      group: 'connection',
      value: 'wired',
      label: 'Wired',
      description: 'USB-C',
      priceDeltaAmount: 0,
      skuCode: 'W',
      isDefault: true,
    },
    {
      group: 'connection',
      value: 'bluetooth',
      label: 'Bluetooth',
      description: 'Bluetooth 5.1 + USB-C',
      priceDeltaAmount: 20_00,
      skuCode: 'BT',
    },
    {
      group: 'connection',
      value: '2-4ghz',
      label: '2.4GHz',
      description: 'Tri-mode with receiver',
      priceDeltaAmount: 30_00,
      skuCode: 'TRI',
    },
  ] satisfies OptionSeed[],
  incompatibilities: [
    {
      groupA: 'layout' as const,
      valueA: '100',
      groupB: 'connection' as const,
      valueB: '2-4ghz',
      reason: 'The 100% case has no room for the tri-mode battery and receiver bay',
    },
    {
      groupA: 'plate' as const,
      valueA: 'polycarbonate',
      groupB: 'switch' as const,
      valueB: 'clicky',
      reason: 'Polycarbonate plates flex too much for click-bar switches',
    },
  ],
};
