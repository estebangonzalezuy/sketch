import { hexToRgb, type RGB } from './palette';

/** Pares locked de tMSC (campo, figura). Máximo 2 tintas por pieza. */
export interface Pair {
  id: string;
  label: string;
  field: string;
  figure: string;
}

export const LOCKED_PAIRS: readonly Pair[] = [
  { id: 'ink-white', label: 'ink/white', field: '#FFFFFF', figure: '#0C0C0C' },
  { id: 'acid-ink', label: 'acid/ink', field: '#E4FC24', figure: '#0C0C0C' },
  { id: 'lilac-brown', label: 'lilac/brown', field: '#CC84FC', figure: '#3C240C' },
  { id: 'magenta-verde', label: 'magenta/verde', field: '#F06CCC', figure: '#0C540C' },
];

export function getPair(id: string): Pair {
  return LOCKED_PAIRS.find((p) => p.id === id) ?? LOCKED_PAIRS[0];
}

export function randomPair(): Pair {
  return LOCKED_PAIRS[Math.floor(Math.random() * LOCKED_PAIRS.length)];
}

export function nextPair(id: string): Pair {
  const i = LOCKED_PAIRS.findIndex((p) => p.id === id);
  return LOCKED_PAIRS[(i + 1) % LOCKED_PAIRS.length];
}

/** Azules retirados el 10 nov 2026. No pueden aparecer en ningún swatch, preview ni export. */
export const RETIRED_BLUES = ['#0000FF', '#3D3DEB'] as const;
const RETIRED_RGB = RETIRED_BLUES.map(hexToRgb);
/** Distancia (RGB 0..1) por debajo de la cual un color cuenta como uno de los azules retirados. */
export const RETIRED_RADIUS = 0.12;

export function isRetiredBlue(c: RGB): boolean {
  return RETIRED_RGB.some((r) => Math.hypot(c[0] - r[0], c[1] - r[1], c[2] - r[2]) < RETIRED_RADIUS);
}

/** Devuelve el color, o `fallback` si es uno de los azules retirados. */
export function guardColor(c: RGB, fallback: RGB): RGB {
  return isRetiredBlue(c) ? fallback : c;
}
