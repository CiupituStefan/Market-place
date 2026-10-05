import { describe, expect, it } from 'vitest';
import {
  assertVariantsMatchOptions,
  buildSearchDocument,
  lowestPrice,
  rollupAvailability,
} from './derived.js';
import type { OptionDefinition } from './dto.js';

const options: OptionDefinition[] = [
  {
    key: 'color',
    name: 'Color',
    display: 'swatch',
    values: [
      { value: 'carbon', label: 'Carbon' },
      { value: 'chalk', label: 'Chalk' },
    ],
  },
  {
    key: 'switch',
    name: 'Switch',
    display: 'pill',
    values: [{ value: 'linear', label: 'Linear' }],
  },
];

describe('rollupAvailability', () => {
  it('takes the most available variant', () => {
    expect(
      rollupAvailability([{ availability: 'OUT_OF_STOCK' }, { availability: 'LOW_STOCK' }]),
    ).toBe('LOW_STOCK');
    expect(rollupAvailability([{ availability: 'PREORDER' }, { availability: 'IN_STOCK' }])).toBe(
      'IN_STOCK',
    );
    expect(rollupAvailability([])).toBe('OUT_OF_STOCK');
  });
});

describe('lowestPrice', () => {
  it('returns the cheapest variant with its own compare-at price', () => {
    expect(
      lowestPrice([
        { priceAmount: 20900, compareAtAmount: null },
        { priceAmount: 18900, compareAtAmount: 19900 },
      ]),
    ).toEqual({ amount: 18900, compareAt: 19900 });
    expect(lowestPrice([])).toBeNull();
  });
});

describe('buildSearchDocument', () => {
  it('collects searchable text, lower-cased', () => {
    expect(
      buildSearchDocument({
        name: 'CSE Forge 75',
        brand: 'CSE',
        tagline: 'Gasket  mounted',
        categoryNames: ['Keyboards'],
        skus: ['CSE-FORGE-75-CAR-LIN'],
        attributes: { layout: ['75%'], switchType: ['Linear'] },
      }),
    ).toBe('cse forge 75 cse gasket mounted keyboards cse-forge-75-car-lin 75% linear');
  });
});

describe('assertVariantsMatchOptions', () => {
  it('accepts consistent variants', () => {
    expect(() => {
      assertVariantsMatchOptions(options, [
        { sku: 'A-1', options: { color: 'carbon', switch: 'linear' } },
        { sku: 'A-2', options: { color: 'chalk', switch: 'linear' } },
      ]);
    }).not.toThrow();
  });

  it('reports every problem with a path', () => {
    try {
      assertVariantsMatchOptions(options, [
        { sku: 'A-1', options: { color: 'carbon', switch: 'linear' } },
        { sku: 'A-1', options: { color: 'carbon', switch: 'linear' } },
        { sku: 'A-3', options: { color: 'navy', switch: 'linear' } },
        { sku: 'A-4', options: { color: 'carbon' } },
      ]);
      expect.unreachable();
    } catch (error) {
      const details = (error as { details: { path: string; message: string }[] }).details;
      expect(details).toEqual(
        expect.arrayContaining([
          { path: 'variants.1.sku', message: 'Duplicate SKU' },
          { path: 'variants.1.options', message: 'Same options as A-1' },
          { path: 'variants.2.options.color', message: 'Unknown value "navy"' },
          expect.objectContaining({ path: 'variants.3.options' }),
        ]),
      );
    }
  });

  it('allows option-less products with a single variant', () => {
    expect(() => {
      assertVariantsMatchOptions([], [{ sku: 'ONE', options: {} }]);
    }).not.toThrow();
  });
});
