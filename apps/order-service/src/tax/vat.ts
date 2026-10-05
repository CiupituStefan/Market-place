import type { ShippingCountry } from '@market/types';

/**
 * Standard VAT rates (basis points) for B2C distance sales into each EU country
 * (OSS: the destination country's rate applies). Reviewed 2026-10; rate changes
 * ship as a code change with review, never as a silent config edit.
 */
export const VAT_RATES_BPS: Record<ShippingCountry, number> = {
  AT: 2_000,
  BE: 2_100,
  BG: 2_000,
  HR: 2_500,
  CY: 1_900,
  CZ: 2_100,
  DK: 2_500,
  EE: 2_400,
  FI: 2_550,
  FR: 2_000,
  DE: 1_900,
  GR: 2_400,
  HU: 2_700,
  IE: 2_300,
  IT: 2_200,
  LV: 2_100,
  LT: 2_100,
  LU: 1_700,
  MT: 1_800,
  NL: 2_100,
  PL: 2_300,
  PT: 2_300,
  RO: 2_100,
  SK: 2_300,
  SI: 2_200,
  ES: 2_100,
  SE: 2_500,
};

/**
 * VAT contained in a VAT-inclusive amount, rounded half-up to the minor unit.
 * Shelf prices are the same in every country; only the VAT share differs.
 */
export function includedVat(grossAmount: number, rateBps: number): number {
  if (grossAmount <= 0 || rateBps <= 0) return 0;
  return Math.round((grossAmount * rateBps) / (10_000 + rateBps));
}
