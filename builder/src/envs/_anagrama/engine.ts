// Motor compartido de Anagrama (15) y Multi-anagrama (16): un solo húngaro, arcos e identidades.
import { font } from "../../core/fonts";

export interface Glyph {
  ch: string;
  x: number; // centro
  y: number; // centro óptico (mitad de la altura de mayúscula): de acá salen los arcos
}

/** altura de media mayúscula en em (Archivo Narrow): la letra se dibuja en y + CAP·px */
export const CAP = 0.35;

/** Letras de una palabra (sin espacios). Mayúsculas y minúsculas cuentan como distintas: se escriben como se quieren ver. */
export function letters(word: string): string[] {
  return [...word.replace(/\s+/g, "")];
}

export function sameMultiset(a: string, b: string): boolean {
  const x = letters(a).sort().join("");
  const y = letters(b).sort().join("");
  return x.length > 0 && x === y;
}

/** Posición de cada glifo: measureText + tracking uniforme (em), centrado en (cx, baseline). */
export function layoutWord(g: CanvasRenderingContext2D, word: string, px: number, tracking: number, cx: number, baseline: number): Glyph[] {
  g.font = font(px, 700);
  const ls = letters(word);
  const widths = ls.map((c) => g.measureText(c).width);
  const gap = tracking * px;
  const total = widths.reduce((s, w) => s + w, 0) + gap * Math.max(0, ls.length - 1);
  let x = cx - total / 2;
  return ls.map((ch, i) => {
    const gx = x + widths[i] / 2;
    x += widths[i] + gap;
    return { ch, x: gx, y: baseline - CAP * px };
  });
}

/** Húngaro (Kuhn–Munkres, O(n³)) para matriz cuadrada de costos. Devuelve col asignada a cada fila. */
export function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  const INF = 1e18;
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(INF);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const out = new Array(n).fill(0);
  for (let j = 1; j <= n; j++) if (p[j]) out[p[j] - 1] = j - 1;
  return out;
}

/**
 * Asignación óptima entre los glifos de dos palabras anagrama: solo letras iguales,
 * costo = distancia² entre centros. Devuelve σ: slot de origen → slot de destino.
 */
export function assign(a: Glyph[], b: Glyph[]): number[] {
  const BIG = 1e12;
  const cost = a.map((ga) => b.map((gb) => (ga.ch === gb.ch ? (ga.x - gb.x) ** 2 + (ga.y - gb.y) ** 2 : BIG)));
  return hungarian(cost);
}

/** Arco cuadrático: altura ∝ distancia; hacia la derecha por arriba, hacia la izquierda por abajo. */
export function arcPoint(p0: Glyph, p1: Glyph, curva: number, u: number): { x: number; y: number } {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const d = Math.hypot(dx, dy);
  // normal n = (−dy, dx)/d; control = medio − n·h. Con y hacia abajo: a la derecha sube, a la izquierda baja,
  // así dos letras que viajan en sentidos opuestos nunca comparten lado.
  const h = curva * d * 0.5;
  const nx = d ? -dy / d : 0;
  const ny = d ? dx / d : 0;
  const cx = (p0.x + p1.x) / 2 - nx * h;
  const cy = (p0.y + p1.y) / 2 - ny * h;
  const k = 1 - u;
  return { x: k * k * p0.x + 2 * k * u * cx + u * u * p1.x, y: k * k * p0.y + 2 * k * u * cy + u * u * p1.y };
}

/** Cubic-bezier (x1,y1,x2,y2) evaluado de forma determinista (bisección sobre x). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const by = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (bx(mid) < x) lo = mid;
      else hi = mid;
    }
    return by((lo + hi) / 2);
  };
}

/** Lee el `ease` de un control easing de DialKit (TransitionConfig); si no es un cubic-bezier, usa uno por defecto. */
export function easeFrom(cfg: unknown, fallback: [number, number, number, number] = [0.65, 0, 0.35, 1]) {
  const e = (cfg as { ease?: unknown } | null)?.ease;
  const arr = Array.isArray(e) && e.length === 4 && e.every((v) => typeof v === "number") ? (e as number[]) : fallback;
  return cubicBezier(arr[0], arr[1], arr[2], arr[3]);
}

/** Muestras de un arco (para trazas y SVG). */
export function arcSamples(p0: Glyph, p1: Glyph, curva: number, u1 = 1, n = 48): { x: number; y: number }[] {
  const out = [];
  const steps = Math.max(1, Math.round(n * u1));
  for (let i = 0; i <= steps; i++) out.push(arcPoint(p0, p1, curva, (i / steps) * u1));
  return out;
}

export function svgPath(pts: { x: number; y: number }[]): string {
  return pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

export function escapeXml(s: string) {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
}
