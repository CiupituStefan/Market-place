import { describe, expect, it } from 'vitest';
import { products } from '../seed/catalog-data.js';
import { romanianProduct, romanianTerm } from '../seed/catalog-data.ro.js';
import {
  LocaleParamSchema,
  localizeCategory,
  localizeProduct,
  localizeSummary,
  ProductTranslationsSchema,
  withoutDiacritics,
} from './translations.js';

const forge = products.find((p) => p.slug === 'cse-forge-75')!;

describe('localizeProduct', () => {
  it('overlays translated fields and keeps the rest', () => {
    const ro = localizeProduct(
      forge,
      { ro: { tagline: 'Tastatură 75%', options: { color: { name: 'Culoare' } } } },
      'ro',
    );
    expect(ro.tagline).toBe('Tastatură 75%');
    expect(ro.name).toBe(forge.name);
    expect(ro.description).toEqual(forge.description);
    expect(ro.options[0]).toMatchObject({ key: 'color', name: 'Culoare' });
    // Values and variants are untouched: only what shoppers read changes.
    expect(ro.options[0]?.values).toEqual(forge.options[0]?.values);
    expect(ro.variants).toBe(forge.variants);
    expect(ro.price).toEqual(forge.price);
  });

  it('translates option value labels by value', () => {
    const ro = localizeProduct(
      forge,
      { ro: { options: { color: { values: { chalk: { label: 'Cretă' } } } } } },
      'ro',
    );
    expect(ro.options[0]?.values.find((v) => v.value === 'chalk')?.label).toBe('Cretă');
    expect(ro.options[0]?.values.find((v) => v.value === 'carbon')?.label).toBe('Carbon');
  });

  it('is English for English, and for languages without a translation', () => {
    const translations = { ro: { tagline: 'Tastatură' } };
    expect(localizeProduct(forge, translations, 'en')).toBe(forge);
    expect(localizeSummary(forge, {}, 'ro')).toBe(forge);
  });

  it('localizes categories', () => {
    const category = {
      id: '1',
      slug: 'keyboards',
      name: 'Keyboards',
      description: 'Boards',
      parentSlug: null,
      preview: forge.preview,
    };
    expect(localizeCategory(category, { ro: { name: 'Tastaturi' } }, 'ro')).toMatchObject({
      name: 'Tastaturi',
      description: 'Boards',
    });
  });
});

describe('locale parameter', () => {
  it('falls back to English for anything unknown', () => {
    expect(LocaleParamSchema.parse(undefined)).toBe('en');
    expect(LocaleParamSchema.parse('ro')).toBe('ro');
    expect(LocaleParamSchema.parse('fr')).toBe('en');
    expect(LocaleParamSchema.parse(['ro', 'en'])).toBe('en');
  });
});

describe('Romanian demo catalog', () => {
  it('has valid Romanian copy for every demo product', () => {
    for (const product of products) {
      const ro = romanianProduct(product);
      expect(ro, product.slug).toBeDefined();
      expect(ProductTranslationsSchema.safeParse({ ro }).success, product.slug).toBe(true);
      expect(ro?.tagline, product.slug).not.toBe(product.tagline);
    }
  });

  it('translates the shared glossary, Romanian plurals and decimal commas', () => {
    expect(romanianTerm('Mounting style')).toBe('Tip de montaj');
    expect(romanianTerm('CSE Forge 75 keyboard')).toBe('Tastatura CSE Forge 75');
    expect(romanianTerm('35 switches')).toBe('35 de switch-uri');
    expect(romanianTerm('210 keys')).toBe('210 taste');
    expect(romanianTerm('1.9 kg')).toBe('1,9 kg');
    expect(romanianTerm('USB-C')).toBe('USB-C');
  });

  it('leaves no keyboard spec label in English', () => {
    const ro = romanianProduct(forge)!;
    const english = new Set(forge.specs.flatMap((g) => g.items.map((i) => i.label)));
    const untranslated = ro
      .specs!.flatMap((g) => g.items.map((i) => i.label))
      .filter(
        (label) =>
          english.has(label) &&
          !['PCB', 'Firmware', 'Bluetooth', '2.4GHz', 'Keycaps', 'RGB'].includes(label),
      );
    expect(untranslated).toEqual([]);
  });
});

describe('withoutDiacritics', () => {
  it('strips Romanian diacritics', () => {
    expect(withoutDiacritics('tastatură șoaptă îți')).toBe('tastatura soapta iti');
  });
});
