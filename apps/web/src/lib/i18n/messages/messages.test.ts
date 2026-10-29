import { describe, expect, it } from 'vitest';
import { en } from './en';
import { ro } from './ro';

describe('Romanian copy', () => {
  it('uses Romanian plurals ("de" from 20 up)', () => {
    expect(ro.listing.products(1)).toBe('1 produs');
    expect(ro.listing.products(3)).toBe('3 produse');
    expect(ro.listing.products(19)).toBe('19 produse');
    expect(ro.listing.products(20)).toBe('20 de produse');
    expect(ro.listing.products(101)).toBe('101 produse');
    expect(ro.listing.products(120)).toBe('120 de produse');
    expect(en.listing.products(1)).toBe('1 product');
  });

  it('translates validation messages and falls back by issue code', () => {
    expect(ro.validation.translate({ code: 'custom', message: 'Passwords do not match.' })).toBe(
      'Parolele nu coincid.',
    );
    expect(ro.validation.translate({ code: 'too_small', message: 'x', minimum: 8 })).toBe(
      'Folosește cel puțin 8 caractere.',
    );
    expect(en.validation.translate({ code: 'custom', message: 'Passwords do not match.' })).toBe(
      'Passwords do not match.',
    );
  });

  it('translates every API error code the English copy has', () => {
    expect(Object.keys(ro.errors.codes).sort()).toEqual(Object.keys(en.errors.codes).sort());
  });
});
