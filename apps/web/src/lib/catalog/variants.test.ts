import { describe, expect, it } from 'vitest';
import { products } from './fixtures';
import { defaultSelection, findVariant, selectValue, valueAvailability } from './variants';

const forge = products.find((p) => p.slug === 'cse-forge-75')!;

describe('variant selection', () => {
  it('defaults to the first purchasable variant', () => {
    const selection = defaultSelection(forge);
    expect(findVariant(forge, selection)?.availability).not.toBe('OUT_OF_STOCK');
  });

  it('reports availability of a value given the other selections', () => {
    expect(valueAvailability(forge, { color: 'chalk', switch: 'linear' }, 'switch', 'clicky')).toBe(
      'OUT_OF_STOCK',
    );
    expect(
      valueAvailability(forge, { color: 'silver', switch: 'linear' }, 'switch', 'clicky'),
    ).toBe('LOW_STOCK');
    expect(valueAvailability(forge, { color: 'carbon', switch: 'linear' }, 'color', 'navy')).toBe(
      'UNAVAILABLE',
    );
  });

  it('keeps the chosen value and adjusts other options when a combination does not exist', () => {
    const atlas = products.find((p) => p.slug === 'cse-atlas-tkl')!;
    const next = selectValue(atlas, { color: 'silver', switch: 'tactile' }, 'color', 'navy');
    expect(next.color).toBe('navy');
    expect(findVariant(atlas, next)).toBeDefined();
  });

  it('variant prices come from catalog data (colorway premium)', () => {
    const carbon = findVariant(forge, { color: 'carbon', switch: 'linear' })!;
    const silver = findVariant(forge, { color: 'silver', switch: 'linear' })!;
    expect(silver.price.amount - carbon.price.amount).toBe(2000);
  });
});
