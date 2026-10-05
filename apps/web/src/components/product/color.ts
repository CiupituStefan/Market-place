/** Mixes two #rrggbb colors; t=0 returns a, t=1 returns b. */
export function mix(a: string, b: string, t: number): string {
  const pa = parse(a);
  const pb = parse(b);
  const channel = (i: number) =>
    Math.round((pa[i] ?? 0) + ((pb[i] ?? 0) - (pa[i] ?? 0)) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

function parse(hex: string): number[] {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
}

/** Relative luminance (0–1), used to decide light/dark shading. */
export function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = parse(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const darken = (hex: string, t: number) => mix(hex, '#000000', t);
export const lighten = (hex: string, t: number) => mix(hex, '#ffffff', t);
