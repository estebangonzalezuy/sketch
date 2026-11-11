import type { Palette } from "./env";

// Los únicos 4 pares permitidos. Máximo 2 colores por pieza.
export const PAIRS: Palette[] = [
  { name: "ink", bg: "#0C0C0C", fg: "#FFFFFF" },
  { name: "ácido", bg: "#0C0C0C", fg: "#E4FC24" },
  { name: "lila", bg: "#3C240C", fg: "#CC84FC" },
  { name: "magenta", bg: "#0C540C", fg: "#F06CCC" },
];

export function pairAt(i: number, invert = false): Palette {
  const p = PAIRS[((i % PAIRS.length) + PAIRS.length) % PAIRS.length];
  return invert ? { name: p.name, bg: p.fg, fg: p.bg } : p;
}

export function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
