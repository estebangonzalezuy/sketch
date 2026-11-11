// Pares permitidos (máx. 2 colores por pieza). Nunca #0000FF ni #3D3DEB.
export interface Pair { id: string; label: string; bg: string; fg: string }
export const PAIRS: Pair[] = [
  { id: "ink", label: "tinta + blanco", bg: "#0C0C0C", fg: "#FFFFFF" },
  { id: "acid", label: "ácido + tinta", bg: "#0C0C0C", fg: "#E4FC24" },
  { id: "lilac", label: "lila + marrón", bg: "#3C240C", fg: "#CC84FC" },
  { id: "magenta", label: "magenta + verde", bg: "#0C540C", fg: "#F06CCC" },
];
const BANNED = ["#0000FF", "#3D3DEB"];
export function pairColors(i: number, invert: boolean) {
  const p = PAIRS[((i % PAIRS.length) + PAIRS.length) % PAIRS.length];
  const a = invert ? p.bg : p.fg, b = invert ? p.fg : p.bg;
  if (BANNED.includes(a.toUpperCase()) || BANNED.includes(b.toUpperCase())) throw new Error("color prohibido");
  return { fg: a, bg: b, pair: p };
}
export function hexToRgb01(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
