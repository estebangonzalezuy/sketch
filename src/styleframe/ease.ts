/** Cubic-bezier easing, CSS semantics. y values may leave [0, 1] for overshoot and anticipation. */
export type Curve = [x1: number, y1: number, x2: number, y2: number];

export const CURVES = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  in: [0.55, 0, 1, 0.45],
  out: [0, 0.55, 0.45, 1],
  inOut: [0.65, 0, 0.35, 1],
  expoOut: [0.16, 1, 0.3, 1],
  expoInOut: [0.87, 0, 0.13, 1],
  backOut: [0.34, 1.56, 0.64, 1],
  popOut: [0.2, 2.1, 0.45, 0.9],
  anticipate: [0.6, -0.35, 0.4, 1],
} satisfies Record<string, Curve>;
export type CurveName = keyof typeof CURVES;

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Maps v from [a, b] to [0, 1], clamped. */
export const range = (v: number, a: number, b: number) =>
  b === a ? (v >= b ? 1 : 0) : clamp((v - a) / (b - a));

const cache = new Map<string, (t: number) => number>();

export function bezier(c: Curve): (t: number) => number {
  const key = c.join(',');
  const hit = cache.get(key);
  if (hit) return hit;
  const [x1, y1, x2, y2] = c;
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  const sx = (s: number) => ((ax * s + bx) * s + cx) * s;
  const dx = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  const sy = (s: number) => ((ay * s + by) * s + cy) * s;
  const solve = (x: number) => {
    let s = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(s) - x;
      if (Math.abs(err) < 1e-6) return s;
      const d = dx(s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    let lo = 0;
    let hi = 1;
    s = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(s);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return s;
  };
  const fn = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : sy(solve(t)));
  cache.set(key, fn);
  return fn;
}

export const ease = (c: Curve, t: number) => bezier(c)(clamp(t));

export const curveToCss = (c: Curve) => `cubic-bezier(${c.map((v) => +v.toFixed(2)).join(', ')})`;

/**
 * Local progress of item i of n inside a parent progress p. `overlap` 0 runs them all at once,
 * 1 runs them strictly one after another.
 */
export function stagger(p: number, i: number, n: number, overlap: number) {
  if (n <= 1) return clamp(p);
  const d = 1 / (1 + (n - 1) * overlap);
  return clamp((p - i * overlap * d) / d);
}

/** Deterministic hash → [0, 1). Every "random" choice in a styleframe goes through this. */
export function hash(...n: number[]) {
  let h = 2166136261;
  for (const v of n) {
    h ^= Math.floor(v * 1000) | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
}

/** Quantised or smooth interpolation between two cell sizes. */
export function cellAt(p: number, from: number, to: number, steps: number) {
  if (steps <= 0) return Math.exp(lerp(Math.log(from), Math.log(to), clamp(p)));
  const k = Math.min(steps, Math.floor(clamp(p) * (steps + 1)));
  return Math.round(Math.exp(lerp(Math.log(from), Math.log(to), k / steps)));
}
