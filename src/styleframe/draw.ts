import { clamp } from './ease';
import { captionFont } from './tokens';
import type { Frame } from './types';

type C = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function clear(ctx: C, f: Frame) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = f.pal.bg;
  ctx.fillRect(0, 0, f.w, f.h);
}

export type TextOpts = {
  size?: number;
  weight?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  color?: string;
};

/** Caption text in Archivo Narrow, sized in 1080-units. */
export function caption(ctx: C, f: Frame, text: string, x: number, y: number, o: TextOpts = {}) {
  ctx.font = captionFont(f.u, o.size, o.weight);
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'alphabetic';
  ctx.fillStyle = o.color ?? f.pal.fg;
  ctx.fillText(text, x, y);
}

/** Types `text` on character by character as p goes 0 → 1. */
export function typeOn(text: string, p: number) {
  return text.slice(0, Math.round(clamp(p) * text.length));
}

/** The closing label, e.g. "tMSC / Glyph Construct 01", bottom-left with a short rule. */
export function endLabel(ctx: C, f: Frame, p: number, text = f.common.label) {
  if (p <= 0 || !text) return;
  const m = 44 * f.u;
  const y = f.h - m;
  const s = typeOn(text, p * 1.6);
  ctx.save();
  ctx.fillStyle = f.pal.fg;
  ctx.fillRect(m, y - 34 * f.u, 36 * f.u * clamp(p * 3), Math.max(1, 2 * f.u));
  caption(ctx, f, s, m, y, { size: 22, weight: 500 });
  ctx.restore();
}

/** Frame-safe line width that stays crisp at 1080 and scales with the frame. */
export const lw = (f: Frame, w: number) => Math.max(1, w * f.u);
