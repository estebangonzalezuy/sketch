import type { Palette } from "./env";

// Los únicos 4 pares permitidos. Nunca #0000FF ni #3D3DEB.
export const PAIRS: Palette[] = [
  { name: "ink", bg: "#0C0C0C", fg: "#FFFFFF" },
  { name: "ácido", bg: "#0C0C0C", fg: "#E4FC24" },
  { name: "lila", bg: "#3C240C", fg: "#CC84FC" },
  { name: "magenta", bg: "#0C540C", fg: "#F06CCC" },
];

export function pair(i: number, invert = false): Palette {
  const p = PAIRS[((i % PAIRS.length) + PAIRS.length) % PAIRS.length];
  return invert ? { name: p.name + " inv", bg: p.fg, fg: p.bg } : p;
}

export const FORBIDDEN = ["#0000FF", "#3D3DEB"];
