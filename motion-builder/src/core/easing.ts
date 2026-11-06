export type Ease = [number, number, number, number] | 'hold';

/** cubic-bezier(x1, y1, x2, y2) evaluada en u ∈ [0, 1]: Newton con bisección de respaldo. */
export function bezier([x1, y1, x2, y2]: [number, number, number, number], u: number) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;

  let t = u;
  for (let i = 0; i < 8; i++) {
    const err = sampleX(t) - u;
    if (Math.abs(err) < 1e-7) return ((ay * t + by) * t + cy) * t;
    const slope = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(slope) < 1e-6) break;
    t -= err / slope;
  }
  let lo = 0;
  let hi = 1;
  t = u;
  for (let i = 0; i < 40; i++) {
    if (sampleX(t) < u) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return ((ay * t + by) * t + cy) * t;
}

export const applyEase = (ease: Ease, u: number) => (ease === 'hold' ? 0 : bezier(ease, u));
