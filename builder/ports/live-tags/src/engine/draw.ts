import { hexToRgb, type Palette } from "../palettes";
import { W, H } from "../types";

const FONT = '"Archivo Narrow"';

export function fillBackground(ctx: CanvasRenderingContext2D, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
) {
  if (video.readyState >= 2) {
    ctx.drawImage(video, 0, 0, W, H);
  } else {
    fillBackground(ctx, "#0C0C0C");
  }
}

function measure(ctx: CanvasRenderingContext2D, text: string, font: string): { w: number; h: number } {
  ctx.save();
  ctx.font = font;
  const m = ctx.measureText(text);
  const h =
    (m.actualBoundingBoxAscent ?? 0) + (m.actualBoundingBoxDescent ?? 0) ||
    parseInt(font, 10) * 0.9;
  const w = m.width;
  ctx.restore();
  return { w, h };
}

export type TagLayout = { x: number; y: number; w: number; h: number };

function clampBox(px: number, py: number, tw: number, th: number, ox: number, oy: number, margin = 16) {
  const x = Math.min(Math.max(margin, px + ox), W - tw - margin);
  const y = Math.min(Math.max(margin, py + oy), H - th - margin);
  return { x, y };
}

function nearestOnRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number) {
  if (px > rx && px < rx + rw && py > ry && py < ry + rh) {
    const opts: [number, number, number][] = [
      [px - rx, rx, py],
      [rx + rw - px, rx + rw, py],
      [py - ry, px, ry],
      [ry + rh - py, px, ry + rh],
    ];
    opts.sort((a, b) => a[0] - b[0]);
    return { x: opts[0][1], y: opts[0][2] };
  }
  return {
    x: Math.min(Math.max(px, rx), rx + rw),
    y: Math.min(Math.max(py, ry), ry + rh),
  };
}

export function drawTag(
  ctx: CanvasRenderingContext2D,
  anchor: { x: number; y: number },
  left: string,
  right: string,
  fg: string,
  bg: string,
  opts: {
    scale?: number;
    alpha?: number;
    offset?: { x: number; y: number };
    leader?: string;
    ring?: string;
    drawLeader?: boolean;
    drawDot?: boolean;
    leftSize?: number;
    rightSize?: number;
  } = {},
): TagLayout {
  const scale = opts.scale ?? 1;
  const alpha = opts.alpha ?? 1;
  const offset = opts.offset ?? { x: 28, y: -70 };
  const leftSize = Math.max(8, Math.round((opts.leftSize ?? 22) * scale));
  const rightSize = Math.max(10, Math.round((opts.rightSize ?? 40) * scale));
  const padX = Math.round(14 * scale);
  const padY = Math.round(9 * scale);
  const gap = left ? Math.round(7 * scale) : 0;
  const fLeft = `500 ${leftSize}px ${FONT}`;
  const fRight = `700 ${rightSize}px ${FONT}`;
  const lm = left ? measure(ctx, left, fLeft) : { w: 0, h: 0 };
  const rm = measure(ctx, right, fRight);
  const innerH = Math.max(rm.h, lm.h + Math.round(8 * scale));
  const tw = (left ? lm.w + gap : 0) + rm.w + padX * 2;
  const th = innerH + padY * 2;
  const box = clampBox(anchor.x, anchor.y, tw, th, offset.x, offset.y);

  ctx.save();
  ctx.globalAlpha = alpha;

  if (opts.drawLeader !== false) {
    const hit = nearestOnRect(anchor.x, anchor.y, box.x, box.y, tw, th);
    ctx.strokeStyle = opts.leader ?? fg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(hit.x, hit.y);
    ctx.stroke();
  }

  if (opts.drawDot !== false) {
    const r = 7 * Math.max(0.8, scale);
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, r + 2, 0, Math.PI * 2);
    ctx.fillStyle = opts.ring ?? bg;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, r, 0, Math.PI * 2);
    ctx.fillStyle = fg;
    ctx.fill();
  }

  ctx.fillStyle = bg;
  ctx.fillRect(box.x, box.y, tw, th);

  let tx = box.x + padX;
  const baseline = (font: string, y: number, text: string, color: string) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    const m = ctx.measureText(text);
    const ascent = m.actualBoundingBoxAscent || parseInt(font, 10) * 0.8;
    ctx.fillText(text, tx, y + ascent);
  };

  const textY = box.y + padY + Math.max(0, (innerH - rm.h) / 2);
  if (left) {
    baseline(fLeft, box.y + padY, left, fg);
    tx += lm.w + gap;
  }
  baseline(fRight, textY, right, fg);

  ctx.restore();
  return { x: box.x, y: box.y, w: tw, h: th };
}

export function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fill: string,
  ring: string,
  r = 6,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, r + 2, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

export function drawTrail(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  color: string,
  width: number,
  alpha = 1,
) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
}

/** Technical dimension line with end ticks and a boxed label. */
export function drawCota(
  ctx: CanvasRenderingContext2D,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  label: string,
  color: string,
  textBg: string,
  textFg: string,
  scale = 1,
  alpha = 1,
) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const L = Math.hypot(dx, dy) || 1;
  const px = -dy / L;
  const py = dx / L;
  const tick = 14;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  for (const p of [p1, p2]) {
    ctx.beginPath();
    ctx.moveTo(p.x - px * tick, p.y - py * tick);
    ctx.lineTo(p.x + px * tick, p.y + py * tick);
    ctx.stroke();
  }

  const size = Math.max(16, Math.round(32 * scale));
  const font = `700 ${size}px ${FONT}`;
  const m = measure(ctx, label, font);
  const pad = Math.round(8 * scale);
  const bw = m.w + pad * 2;
  const bh = m.h + pad * 2;
  const mx = (p1.x + p2.x) / 2 + px * 18 - bw / 2;
  const my = (p1.y + p2.y) / 2 + py * 18 - bh / 2;
  const x = Math.min(Math.max(8, mx), W - bw - 8);
  const y = Math.min(Math.max(8, my), H - bh - 8);
  ctx.fillStyle = textBg;
  ctx.fillRect(x, y, bw, bh);
  ctx.font = font;
  ctx.fillStyle = textFg;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const tm = ctx.measureText(label);
  const ascent = tm.actualBoundingBoxAscent || size * 0.8;
  ctx.fillText(label, x + pad, y + pad + ascent);
  ctx.restore();
}

export function drawSwatchTag(
  ctx: CanvasRenderingContext2D,
  anchor: { x: number; y: number },
  name: string,
  hex: string,
  swatch: [number, number, number],
  fg: string,
  bg: string,
  opts: { scale?: number; alpha?: number; offset?: { x: number; y: number }; leader?: string } = {},
) {
  const scale = opts.scale ?? 1;
  const alpha = opts.alpha ?? 1;
  const offset = opts.offset ?? { x: 30, y: -70 };
  const chip = Math.round(42 * scale);
  const gap = Math.round(12 * scale);
  const padX = Math.round(12 * scale);
  const padY = Math.round(10 * scale);
  const fName = `700 ${Math.round(32 * scale)}px ${FONT}`;
  const fHex = `500 ${Math.round(22 * scale)}px ${FONT}`;
  const nm = measure(ctx, name, fName);
  const hm = measure(ctx, hex, fHex);
  const tw = padX + chip + gap + Math.max(nm.w, hm.w) + padX;
  const th = padY + Math.max(chip, nm.h + 4 + hm.h) + padY;
  const box = clampBox(anchor.x, anchor.y, tw, th, offset.x, offset.y);

  ctx.save();
  ctx.globalAlpha = alpha;
  const hit = nearestOnRect(anchor.x, anchor.y, box.x, box.y, tw, th);
  ctx.strokeStyle = opts.leader ?? fg;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.lineTo(hit.x, hit.y);
  ctx.stroke();
  drawDot(ctx, anchor.x, anchor.y, fg, bg, 7 * Math.max(0.8, scale), 1);

  ctx.fillStyle = bg;
  ctx.fillRect(box.x, box.y, tw, th);

  const cx = box.x + padX;
  const cy = box.y + (th - chip) / 2;
  ctx.fillStyle = `rgb(${swatch[0]},${swatch[1]},${swatch[2]})`;
  ctx.fillRect(cx, cy, chip, chip);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx + 0.5, cy + 0.5, chip - 1, chip - 1);

  const tx = cx + chip + gap;
  ctx.fillStyle = fg;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = fName;
  const na = ctx.measureText(name).actualBoundingBoxAscent || 24;
  ctx.fillText(name, tx, box.y + padY + na);
  ctx.font = fHex;
  const ha = ctx.measureText(hex).actualBoundingBoxAscent || 16;
  ctx.fillText(hex, tx, box.y + padY + nm.h + 4 + ha);
  ctx.restore();
}

/** Keep typography helpers available for HUD labels. */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight: 500 | 700 = 700,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function paletteInk(p: Palette): { fg: string; bg: string; canvas: string; mark: string } {
  // never leak a forbidden color
  for (const c of [p.fg, p.bg, p.canvas, p.mark]) {
    if (c === "#0000FF" || c === "#3D3DEB") {
      throw new Error("forbidden color in palette");
    }
  }
  return p;
}

export { hexToRgb };
