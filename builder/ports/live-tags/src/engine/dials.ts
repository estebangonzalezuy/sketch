import type { Dials, Track } from "../types";

/** Gap in seconds between successive tag births. High ritmo → faster cascade. */
export function appearGap(ritmo: number): number {
  return 0.7 - 0.45 * clamp01(ritmo);
}

/** Tag / mark scale. 0 → 0.7, 1 → 1.4 */
export function sizeScale(tamaño: number): number {
  return 0.7 + 0.7 * clamp01(tamaño);
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function easeOut(t: number): number {
  const x = clamp01(t);
  return 1 - (1 - x) ** 3;
}

/** Fade/scale in over `dur` seconds after appearAt. */
export function appearK(t: number, appearAt: number, dur = 10 / 30): { alpha: number; scale: number } {
  if (t < appearAt) return { alpha: 0, scale: 0 };
  const age = t - appearAt;
  if (age < dur) {
    const k = easeOut(age / dur);
    return { alpha: k, scale: 0.82 + 0.18 * k };
  }
  return { alpha: 1, scale: 1 };
}

export type Scheduled<T> = T & { appearAt: number };

/**
 * Pick a stable prefix of `ranked` according to cantidad, then assign
 * appearAt so each item is born on its own beat after it exists, never as a list.
 */
export function schedule<T extends { born: number }>(
  ranked: T[],
  dials: Dials,
  fps: number,
  minCount = 1,
): Scheduled<T>[] {
  if (ranked.length === 0) return [];
  // Small sets (cotas, swatches): don't drop the last item at 0.8.
  const frac = clamp01(dials.cantidad);
  const n =
    ranked.length <= 8 && frac >= 0.7
      ? ranked.length
      : Math.max(minCount, Math.round(frac * ranked.length));
  const picked = ranked.slice(0, Math.min(ranked.length, n));
  const gap = appearGap(dials.ritmo);
  // Per-object timing, not a list cascade:
  // things already in frame at the start get a short stagger;
  // anything that enters later appears shortly after it exists.
  let startIndex = 0;
  const out: Scheduled<T>[] = [];
  for (const item of picked) {
    const enter = item.born / fps;
    if (enter <= 0.25) startIndex += 1;
  }
  // pack already-present objects into a short window; ritmo shortens it
  const nStart = startIndex;
  const startSpan = Math.max(0.2, Math.min(0.75, 0.2 + (1 - dials.ritmo) * 0.55));
  startIndex = 0;
  for (const item of picked) {
    const enter = item.born / fps;
    let appearAt: number;
    if (enter <= 0.25) {
      appearAt = 0.08 + (nStart <= 1 ? 0 : startIndex * (startSpan / nStart));
      startIndex += 1;
    } else {
      appearAt = enter + gap * 0.15;
    }
    out.push({ ...item, appearAt });
  }
  return out;
}

export function rankByScore(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => b.score - a.score || Number(a.id) - Number(b.id));
}

export function rankByHits(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => b.hits - a.hits || a.born - b.born);
}

/** Split a path wherever the point teleports (YOLO box flicker). */
export function cleanSegments(
  path: { x: number; y: number; f: number }[],
  maxJump = 80,
): { x: number; y: number; f: number }[][] {
  const segs: { x: number; y: number; f: number }[][] = [];
  let cur: { x: number; y: number; f: number }[] = [];
  for (const p of path) {
    const prev = cur[cur.length - 1];
    if (prev) {
      const dt = Math.max(1, p.f - prev.f);
      const d = Math.hypot(p.x - prev.x, p.y - prev.y) / dt;
      if (d > maxJump) {
        if (cur.length >= 2) segs.push(cur);
        cur = [];
      }
    }
    cur.push(p);
  }
  if (cur.length >= 2) segs.push(cur);
  return segs;
}

export type Segment = { pts: { x: number; y: number; f: number }[]; len: number; net: number; dur: number; jagged: number };

export function bestSegment(path: { x: number; y: number; f: number }[], maxJump = 80, maxJagged = 2.4): Segment | null {
  const segs = cleanSegments(path, maxJump);
  let best: Segment | null = null;
  for (const s of segs) {
    let len = 0;
    for (let i = 1; i < s.length; i++) len += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
    const net = Math.hypot(s[s.length - 1].x - s[0].x, s[s.length - 1].y - s[0].y);
    const dur = s[s.length - 1].f - s[0].f;
    const jagged = len / Math.max(net, 1);
    if (jagged > maxJagged) continue;
    if (!best || len > best.len) best = { pts: s, len, net, dur, jagged };
  }
  return best;
}

export function isMoving(t: Track, minNet = 80, minLen = 120, minDur = 20): boolean {
  const b = bestSegment(t.path);
  if (!b) return false;
  return b.net >= minNet && b.len >= minLen && b.dur >= minDur;
}

export function pickPerBucket(tracks: Track[], cantidad: number): Track[] {
  const groups = new Map<string, Track[]>();
  for (const t of tracks) {
    const k = t.bucket ?? t.cls;
    const g = groups.get(k) ?? [];
    g.push(t);
    groups.set(k, g);
  }
  const frac = clamp01(cantidad);
  const out: Track[] = [];
  for (const g of groups.values()) {
    const ranked = rankByHits(g);
    const n =
      ranked.length <= 3 && frac >= 0.7
        ? ranked.length
        : Math.max(1, Math.round(frac * ranked.length));
    out.push(...ranked.slice(0, n));
  }
  out.sort((a, b) => a.born - b.born);
  return out;
}
