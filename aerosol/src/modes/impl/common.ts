import { BRAND_FONT } from '../../text';
import type { ModeFrame } from '../../gl/renderer';
import type { DialValues } from '../types';

export const num = (v: DialValues, k: string) => Number(v[k]);
export const str = (v: DialValues, k: string) => String(v[k] ?? '');
export const bool = (v: DialValues, k: string) => Boolean(v[k]);

export function font(weight: number, px: number): string {
  return `${Math.round(weight)} ${px}px "${BRAND_FONT}", "Arial Narrow", Arial, sans-serif`;
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeInOut = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
/** Crece de 0 a 1 con un overshoot corto. */
export const easeOutBack = (x: number, k = 1.4) => {
  const t = clamp01(x) - 1;
  return 1 + (k + 1) * t * t * t + k * t * t;
};

export const FILLS = ['glyph', 'field', 'both'];

export function baseFrame(over: Partial<ModeFrame> = {}): ModeFrame {
  return { progress: 1, fill: 0, photo: 0, reveal: 0, gain: 1, knife: null, paper: 0, sort: false, ...over };
}

export function clear(c: CanvasRenderingContext2D): void {
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.fillStyle = '#000';
  c.fillRect(0, 0, c.canvas.width, c.canvas.height);
  c.restore();
}

/** Mide una línea y devuelve el tamaño de fuente para que ocupe `width` px. */
export function fitFont(c: CanvasRenderingContext2D, text: string, weight: number, width: number): number {
  c.font = font(weight, 100);
  const m = c.measureText(text || ' ');
  return (100 * width) / Math.max(1, m.width);
}

/** Dibuja una línea centrada ópticamente (por su caja de tinta) en (x, y). */
export function drawCentered(c: CanvasRenderingContext2D, text: string, weight: number, px: number, x: number, y: number): void {
  c.font = font(weight, px);
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  const m = c.measureText(text);
  const asc = m.actualBoundingBoxAscent;
  const desc = m.actualBoundingBoxDescent;
  const dx = (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2;
  c.fillText(text, x + dx, y + (asc - desc) / 2);
}
