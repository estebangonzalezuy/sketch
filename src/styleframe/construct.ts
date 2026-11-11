/**
 * Construction vocabulary: guides, ticks, dimensions, coordinate tags, markers. Every primitive
 * takes a progress p (0..1) and draws its own partial state, so any tool can stagger them.
 */
import { clamp, range } from './ease';
import { typeOn } from './draw';
import { captionFont } from './tokens';
import type { Frame } from './types';

type C = CanvasRenderingContext2D;
export type Pt = { x: number; y: number };

/** Line from a to b drawn up to p. `fromMiddle` grows it outwards from its centre instead. */
export function line(ctx: C, a: Pt, b: Pt, p: number, fromMiddle = false) {
  p = clamp(p);
  if (p <= 0) return;
  ctx.beginPath();
  if (fromMiddle) {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    ctx.moveTo(mx + (a.x - mx) * p, my + (a.y - my) * p);
    ctx.lineTo(mx + (b.x - mx) * p, my + (b.y - my) * p);
  } else {
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p);
  }
  ctx.stroke();
}

/** Polyline traced along its perimeter up to p. */
export function polyline(ctx: C, pts: Pt[], p: number, closed = false) {
  const path = closed ? [...pts, pts[0]] : pts;
  const lens = path.slice(1).map((q, i) => Math.hypot(q.x - path[i].x, q.y - path[i].y));
  const total = lens.reduce((s, l) => s + l, 0);
  let left = clamp(p) * total;
  if (left <= 0) return;
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 0; i < lens.length && left > 0; i++) {
    const k = Math.min(1, left / lens[i]);
    ctx.lineTo(
      path[i].x + (path[i + 1].x - path[i].x) * k,
      path[i].y + (path[i + 1].y - path[i].y) * k,
    );
    left -= lens[i];
  }
  ctx.stroke();
}

export function arc(ctx: C, c: Pt, r: number, a0: number, p: number) {
  if (p <= 0) return;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, a0, a0 + Math.PI * 2 * clamp(p));
  ctx.stroke();
}

export type TagOpts = {
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  size?: number;
  weight?: number;
  /** Paint a background-coloured box behind the text so lines break around it. */
  knockout?: boolean;
};

/** A small caption. Knockout keeps the piece to two colours while separating text from lines. */
export function tag(ctx: C, f: Frame, text: string, x: number, y: number, o: TagOpts = {}) {
  if (!text) return;
  ctx.font = captionFont(f.u, o.size, o.weight);
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'middle';
  if (o.knockout) {
    const m = ctx.measureText(text);
    const pad = 5 * f.u;
    const hgt = (o.size ?? 19) * f.u * 1.15;
    const left =
      ctx.textAlign === 'center' ? x - m.width / 2 : ctx.textAlign === 'right' ? x - m.width : x;
    const top =
      ctx.textBaseline === 'middle' ? y - hgt / 2 : ctx.textBaseline === 'top' ? y : y - hgt;
    ctx.fillStyle = f.pal.bg;
    ctx.fillRect(left - pad, top - pad * 0.4, m.width + pad * 2, hgt + pad * 0.8);
  }
  ctx.fillStyle = f.pal.fg;
  ctx.fillText(text, x, y);
}

export const coord = (p: Pt) => `x${Math.round(p.x)} y${Math.round(p.y)}`;

/** Square anchor marker; hollow (background fill) or solid. */
export function square(ctx: C, f: Frame, p: Pt, size: number, solid = false, scale = 1) {
  const s = size * f.u * scale;
  if (s <= 0.2) return;
  ctx.fillStyle = solid ? f.pal.fg : f.pal.bg;
  ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  if (!solid) ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
}

export function dot(ctx: C, p: Pt, r: number) {
  if (r <= 0) return;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function cross(ctx: C, p: Pt, r: number) {
  ctx.beginPath();
  ctx.moveTo(p.x - r, p.y);
  ctx.lineTo(p.x + r, p.y);
  ctx.moveTo(p.x, p.y - r);
  ctx.lineTo(p.x, p.y + r);
  ctx.stroke();
}

/**
 * Architectural dimension between a and b, offset perpendicular by `offset` px: extension lines,
 * slash ticks, and a value that counts up from 0.
 */
export function dimension(
  ctx: C,
  f: Frame,
  a: Pt,
  b: Pt,
  value: number,
  offset: number,
  p: number,
) {
  p = clamp(p);
  if (p <= 0) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const A = { x: a.x + nx * offset, y: a.y + ny * offset };
  const B = { x: b.x + nx * offset, y: b.y + ny * offset };
  const ext = range(p, 0, 0.35);
  const sgn = Math.sign(offset) || 1;
  const e0 = 8 * f.u * sgn;
  const e1 = 10 * f.u * sgn;
  line(ctx, { x: a.x + nx * e0, y: a.y + ny * e0 }, { x: A.x + nx * e1, y: A.y + ny * e1 }, ext);
  line(ctx, { x: b.x + nx * e0, y: b.y + ny * e0 }, { x: B.x + nx * e1, y: B.y + ny * e1 }, ext);
  const main = range(p, 0.15, 0.75);
  line(ctx, A, B, main, true);
  const tick = 7 * f.u * range(p, 0.6, 0.8);
  if (tick > 0) {
    for (const q of [A, B]) {
      ctx.beginPath();
      ctx.moveTo(q.x - tick, q.y + tick);
      ctx.lineTo(q.x + tick, q.y - tick);
      ctx.stroke();
    }
  }
  const count = range(p, 0.2, 0.95);
  if (count > 0) {
    const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    tag(ctx, f, String(Math.round(value * count)), mid.x, mid.y, {
      align: 'center',
      knockout: true,
    });
  }
}

/** Angle mark at vertex v between rays to a and b, with its value in degrees. */
export function angle(ctx: C, f: Frame, v: Pt, a: Pt, b: Pt, p: number) {
  if (p <= 0) return;
  const a0 = Math.atan2(a.y - v.y, a.x - v.x);
  const a1 = Math.atan2(b.y - v.y, b.x - v.x);
  let d = a1 - a0;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const r = 30 * f.u;
  ctx.beginPath();
  ctx.arc(v.x, v.y, r, a0, a0 + d * clamp(p), d < 0);
  ctx.stroke();
  if (p > 0.5) {
    const mid = a0 + d / 2;
    const deg = (Math.abs(d) * 180) / Math.PI;
    tag(
      ctx,
      f,
      `${deg.toFixed(2)}°`,
      v.x + Math.cos(mid) * r * 2.1,
      v.y + Math.sin(mid) * r * 2.1,
      {
        align: 'center',
        size: 16,
      },
    );
  }
}

export { typeOn };
