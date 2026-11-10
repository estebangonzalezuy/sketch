import type { ModeImpl } from './index';
import { baseFrame, clear, drawCentered, easeInOut, easeOutBack, fitFont, font, num, str } from './common';

// B · Dato Grande (Cosmos DataViz1): un dato por pieza, el número es la imagen. Solo círculos,
// elipses o barras planas; sin ejes, leyendas ni tablas. El área de cada forma encodea el valor y
// su densidad de puntos (stipple) también: una forma al 8 % es casi aire, la mayor es sólida.

const GROW_S = 0.7;
const SORT_S = 0.5;

export interface Datum {
  value: number;
  token: string;
}

/** "59%, 28%, 39, 8" → valores con su texto original. Ignora lo que no es número; máximo 6. */
export function parseValues(text: string): Datum[] {
  const out: Datum[] = [];
  for (const m of text.matchAll(/-?\d+(?:[.,]\d+)?\s*%?/g)) {
    const value = Math.abs(parseFloat(m[0].replace(',', '.')));
    if (value > 0) out.push({ value, token: m[0].replace(/\s+/g, '') });
    if (out.length === 6) break;
  }
  return out.length ? out : [{ value: 1, token: '1' }];
}

interface Shape {
  x: number;
  y: number;
  r: number;
}

/** Posiciones sin centrar, en el orden dado. */
function layoutShapes(layout: string, radii: number[], pack: number): Shape[] {
  const out: Shape[] = [];
  if (layout === 'pack') {
    const gap = (1 - pack) * Math.max(...radii) * 0.15;
    radii.forEach((r, i) => {
      if (i === 0) return out.push({ x: 0, y: 0, r });
      let best: Shape | null = null;
      let bestD = Infinity;
      for (const p of out) {
        for (let k = 0; k < 72; k++) {
          const a = (k / 72) * Math.PI * 2;
          const c = { x: p.x + Math.cos(a) * (p.r + r + gap), y: p.y + Math.sin(a) * (p.r + r + gap), r };
          if (out.some((q) => Math.hypot(q.x - c.x, q.y - c.y) < q.r + r + gap - 0.5)) continue;
          const d = Math.hypot(c.x, c.y);
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
      }
      out.push(best ?? { x: 0, y: 0, r });
    });
    return out;
  }
  // discs y venn: fila de formas que se pisan; Pack decide cuánto.
  const overlap = layout === 'venn' ? 0.3 + pack * 0.35 : 0.08 + pack * 0.4;
  let x = 0;
  radii.forEach((r, i) => {
    if (i > 0) x += (radii[i - 1] + r) * (1 - overlap);
    out.push({ x, y: (i % 2 ? 1 : -1) * r * 0.18, r });
  });
  return out;
}

/** Centra el grupo en el cuadro y lo achica si no entra en `fit` del ancho y del alto. */
function center(shapes: Shape[], w: number, h: number, sx = 1.18, fit = 0.84): Shape[] {
  const minX = Math.min(...shapes.map((s) => s.x - s.r * sx));
  const maxX = Math.max(...shapes.map((s) => s.x + s.r * sx));
  const minY = Math.min(...shapes.map((s) => s.y - s.r));
  const maxY = Math.max(...shapes.map((s) => s.y + s.r));
  const k = Math.min(1, (fit * w) / (maxX - minX), (fit * h) / (maxY - minY));
  const mx = (minX + maxX) / 2;
  const my = (minY + maxY) / 2;
  return shapes.map((s) => ({ x: w / 2 + (s.x - mx) * k, y: h / 2 + (s.y - my) * k, r: s.r * k }));
}

function timing(v: Record<string, unknown>) {
  const sort = Boolean(v.sort);
  return { sort, intro: GROW_S + (sort ? SORT_S : 0) };
}

export const datoGrande: ModeImpl = {
  duration: (v) => timing(v).intro + num(v, 'hold'),
  key: (t, v) => {
    const { intro } = timing(v);
    // Durante el crecimiento y el reorden se redibuja cada frame; en el hold, una vez.
    const phase = t < intro ? Math.round(t * 60) : 'hold';
    return JSON.stringify([phase, v.layout, v.values, v.scale, v.pack, v.sort, v.labelSize]);
  },
  draw({ fig, crisp, w, h }, t, v) {
    clear(fig);
    clear(crisp);
    const data = parseValues(str(v, 'values'));
    const vmax = Math.max(...data.map((d) => d.value));
    const layout = str(v, 'layout');
    const pack = num(v, 'pack');
    const unit = Math.min(w, h) * num(v, 'scale');
    const { sort } = timing(v);
    const sortedIdx = data.map((_, i) => i).sort((a, b) => data[b].value - data[a].value);
    const sortK = sort ? easeInOut((t - GROW_S) / SORT_S) : 0;
    const grow = (i: number) => easeOutBack((t - i * 0.06) / (GROW_S - 0.06 * (data.length - 1) || GROW_S));
    const maxI = data.findIndex((d) => d.value === vmax);
    const labelPx = Math.min(w, h) * num(v, 'labelSize');
    const showNumeral = t >= GROW_S * 0.6;
    const density = (d: Datum) => Math.max(0.12, d.value / vmax);
    const gray = (k: number) => {
      const c = Math.round(255 * Math.min(1, k));
      return `rgb(${c},${c},${c})`;
    };
    fig.globalCompositeOperation = 'lighter';

    if (layout === 'bars') {
      // Barras planas con el extremo redondeado, apoyadas en una línea de base invisible.
      const bw = unit * 0.2;
      const gap = bw * (0.08 + (1 - pack) * 0.5);
      const hmax = unit * 0.95;
      const slot = (k: number) => k * (bw + gap);
      const total = slot(data.length - 1) + bw;
      const x0 = w / 2 - total / 2;
      const base = h / 2 + hmax / 2;
      const order = data.map((_, i) => i);
      const rank = sortedIdx.reduce<number[]>((acc, i, k) => ((acc[i] = k), acc), []);
      order.forEach((i) => {
        const d = data[i];
        const x = x0 + slot(i) * (1 - sortK) + slot(rank[i]) * sortK;
        const bh = Math.max(bw / 2, hmax * (d.value / vmax) * grow(i));
        fig.fillStyle = gray(density(d));
        fig.beginPath();
        fig.moveTo(x, base);
        fig.lineTo(x, base - bh + bw / 2);
        fig.arc(x + bw / 2, base - bh + bw / 2, bw / 2, Math.PI, 0);
        fig.lineTo(x + bw, base);
        fig.closePath();
        fig.fill();
        if (i === maxI && showNumeral) {
          fig.globalCompositeOperation = 'source-over';
          fig.fillStyle = '#000';
          const px = fitFont(fig, d.token, 700, bw * 0.78);
          drawCentered(fig, d.token, 700, px, x + bw / 2, base - bh + bw * 0.75 + px * 0.35);
          fig.globalCompositeOperation = 'lighter';
        } else if (labelPx > 0 && showNumeral) {
          crisp.fillStyle = '#fff';
          crisp.font = font(500, labelPx);
          crisp.textAlign = 'center';
          crisp.fillText(d.token, x + bw / 2, base - bh - labelPx * 0.6);
        }
      });
      return;
    }

    const radii = data.map((d) => unit * 0.42 * Math.sqrt(d.value / vmax));
    const place = (order: number[]) => {
      const placed = layoutShapes(layout, order.map((i) => radii[i]), pack);
      const res: Shape[] = [];
      order.forEach((i, k) => (res[i] = placed[k]));
      return center(res, w, h);
    };
    const from = place(data.map((_, i) => i));
    const to = sort ? place(sortedIdx) : from;
    const centroid = { x: w / 2, y: h / 2 };
    data.forEach((d, i) => {
      const x = from[i].x + (to[i].x - from[i].x) * sortK;
      const y = from[i].y + (to[i].y - from[i].y) * sortK;
      const rFit = from[i].r + (to[i].r - from[i].r) * sortK;
      const r = rFit * grow(i);
      fig.fillStyle = gray(density(d));
      fig.beginPath();
      if (layout === 'venn') fig.ellipse(x, y, r * 1.18, r * 0.82, (i % 2 ? 1 : -1) * 0.35, 0, Math.PI * 2);
      else fig.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
      fig.fill();
      if (!showNumeral) return;
      if (i === maxI) {
        fig.globalCompositeOperation = 'source-over';
        fig.fillStyle = '#000';
        const px = fitFont(fig, d.token, 700, rFit * 1.15);
        drawCentered(fig, d.token, 700, px, x, y);
        fig.globalCompositeOperation = 'lighter';
      } else if (labelPx > 0) {
        // Label chica, afuera de la forma y lejos del centro del grupo.
        const a = Math.atan2(y - centroid.y, x - centroid.x) || -Math.PI / 2;
        crisp.fillStyle = '#fff';
        crisp.font = font(500, labelPx);
        crisp.textAlign = 'center';
        crisp.textBaseline = 'middle';
        const rr = (layout === 'venn' ? rFit * 1.18 : rFit) + labelPx * 1.2;
        crisp.fillText(d.token, x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
    });
  },
  frame: () => baseFrame({ progress: 1 }),
};


