// Color del entorno Spray: pares locked de tMSC, opciones fuera de pares (marcadas) y guardas contra
// los azules retirados. Todo en sRGB 0..1, como lo usan los shaders.

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const luma = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Pares locked (campo, figura). Máximo 2 tintas por pieza. */
export const LOCKED_PAIRS = {
  'ink/white': ['#FFFFFF', '#0C0C0C'],
  'acid/ink': ['#E4FC24', '#0C0C0C'],
  'lilac/brown': ['#CC84FC', '#3C240C'],
  'magenta/verde': ['#F06CCC', '#0C540C'],
} as const;

/** Fuera de pares locked: existen solo como opción marcada, nunca como default. */
export const UNLOCKED_PAIRS = {
  'naranja señal · fuera de pares': ['#FC540C', '#0C0C0C'],
  'naranja/crema · fuera de pares': ['#FCFCE4', '#FC540C'],
  'gold/black · fuera de pares': ['#FCB400', '#0C0C0C'],
  'papel crema · fuera de pares': ['#F2EEE6', '#111111'],
} as const;

export const PAIR_OPTIONS = [...Object.keys(LOCKED_PAIRS), ...Object.keys(UNLOCKED_PAIRS)] as const;

/** Paleta completa (solo con la opción fuera de pares): tintas tMSC más los campos no locked. */
export const FULL_PALETTE = ['#FFFFFF', '#0C0C0C', '#E4FC24', '#CC84FC', '#3C240C', '#F06CCC', '#0C540C', '#FC540C', '#FCB400', '#F2EEE6'];

export function pairInks(pair: string, invert: boolean): { field: RGB; figure: RGB; locked: boolean } {
  const all = { ...LOCKED_PAIRS, ...UNLOCKED_PAIRS } as Record<string, readonly [string, string]>;
  const [f, g] = all[pair] ?? LOCKED_PAIRS['ink/white'];
  const field = hexToRgb(f);
  const figure = hexToRgb(g);
  return invert ? { field: figure, figure: field, locked: pair in LOCKED_PAIRS } : { field, figure, locked: pair in LOCKED_PAIRS };
}

/** Azules retirados el 10 nov 2026: no pueden aparecer en ningún swatch, preview ni export. */
export const RETIRED_BLUES = ['#0000FF', '#3D3DEB'] as const;
const RETIRED = RETIRED_BLUES.map(hexToRgb);
export const isRetiredBlue = (c: RGB) => RETIRED.some((r) => Math.hypot(c[0] - r[0], c[1] - r[1], c[2] - r[2]) < 0.12);
export const guardColor = (c: RGB, fallback: RGB): RGB => (isRetiredBlue(c) ? fallback : c);

function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function rgbToOklab([r, g, b]: RGB): RGB {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
