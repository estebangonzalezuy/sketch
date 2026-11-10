import type { ParamSpecs } from '../../core/tool';
import { hybridMask } from './hybrid';
import { clamp01, drawCentered, easeOutBack, fitFont, font, modeTool } from './mode';
import { modeFrame } from './pipeline';

// Los 7 modos moodboard (brief del 10 nov 2026, base Notion "tMSC — Universo visual"), ahora como tools.
// La intro de cada uno es un parámetro animable y sus templates la llevan a keyframes editables: el
// "loop de 2 s" de la app original es el template "Afiche (2 s)" sobre un clip de 2 s.

const n = (v: unknown) => Number(v);
const s = (v: unknown) => String(v ?? '');
const FILLS = ['glifo', 'campo', 'ambos'];

const num = (label: string, def: number, min: number, max: number, step: number, group = 'Modo', animate: 'frame' | 'none' = 'frame') =>
  ({ kind: 'number', default: def, min, max, step, label, animate, group }) as const;
const text = (label: string, def: string, multiline = false) => ({ kind: 'text', default: def, label, multiline, animate: 'none', group: 'Modo' }) as const;
const bool = (label: string, def: boolean) => ({ kind: 'boolean', default: def, label, animate: 'frame', group: 'Modo' }) as const;
const select = (label: string, def: string, options: string[]) => ({ kind: 'select', default: def, options, label, animate: 'frame', group: 'Modo' }) as const;

const EFFECTS_OFF = { saturation: 1, pale: 0, wave: 0, glass: 0, chroma: 0, glow: 0 };

// ---------------------------------------------------------------- A · Una Palabra

const unaPalabraParams: ParamSpecs = {
  text: text('palabra', 'THOROUGH'),
  weight: num('peso', 700, 400, 700, 1),
  scale: num('escala', 0.62, 0.1, 1.2, 0.01),
  posX: num('posición x', 0.5, 0, 1, 0.01),
  posY: num('posición y', 0.5, 0, 1, 0.01),
  bleed: num('a sangre', 0, 0, 1, 0.01),
  fill: select('relleno', 'glifo', FILLS),
  spray: num('spray', 1, 0, 1, 0.001),
};

export const unaPalabra = modeTool({
  id: 'una-palabra',
  name: 'Una Palabra',
  params: unaPalabraParams,
  paint: { airbrush: 1.6, grain: 18, boil: 0.6, ...EFFECTS_OFF },
  animations: {
    'Afiche (2 s)': { tracks: { spray: [[0, 0, 'out'], [0.3, 1]] } },
    'Spray lento': { tracks: { spray: [[0, 0, 'inOut'], [0.8, 1]] } },
    'A sangre': { values: { spray: 1 }, tracks: { bleed: [[0, 0, 'inOut'], [1, 0.7]] } },
    'Llena y se va': { tracks: { spray: [[0, 0, 'out'], [0.3, 1, 'hold'], [0.7, 1, 'in'], [1, 0]] } },
  },
  presets: {
    THOROUGH: { text: 'THOROUGH', scale: 0.62, bleed: 0, fill: 'glifo', pair: 'ink/white' },
    '2020': { text: '2020', scale: 0.9, bleed: 0.55, fill: 'glifo', pair: 'acid/ink' },
    'Campo': { text: 'CATALOG', scale: 0.5, fill: 'campo', pair: 'ink/white' },
  },
  key: (p) => JSON.stringify([p.text, p.weight, p.scale, p.posX, p.posY, p.bleed]),
  draw({ fig, w, h }, p) {
    const word = s(p.text).trim() || ' ';
    const width = w * n(p.scale) * (1 + n(p.bleed) * 2.2);
    fig.fillStyle = '#fff';
    drawCentered(fig, word, n(p.weight), fitFont(fig, word, n(p.weight), width), n(p.posX) * w, (1 - n(p.posY)) * h);
  },
  frame: (p) => modeFrame({ progress: n(p.spray), fill: Math.max(0, FILLS.indexOf(s(p.fill))) }),
});

// ---------------------------------------------------------------- B · Dato Grande

interface Datum {
  value: number;
  token: string;
}

/** "59%, 28%, 39, 8" → valores con su texto. Máximo 6. */
export function parseValues(input: string): Datum[] {
  const out: Datum[] = [];
  for (const m of input.matchAll(/-?\d+(?:[.,]\d+)?\s*%?/g)) {
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

function layoutShapes(layout: string, radii: number[], pack: number): Shape[] {
  const out: Shape[] = [];
  if (layout === 'pack') {
    const gap = (1 - pack) * Math.max(...radii) * 0.15;
    radii.forEach((r, i) => {
      if (i === 0) return out.push({ x: 0, y: 0, r });
      let best: Shape | null = null;
      let bestD = Infinity;
      for (const q of out) {
        for (let k = 0; k < 72; k++) {
          const a = (k / 72) * Math.PI * 2;
          const c = { x: q.x + Math.cos(a) * (q.r + r + gap), y: q.y + Math.sin(a) * (q.r + r + gap), r };
          if (out.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < o.r + r + gap - 0.5)) continue;
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
  const overlap = layout === 'venn' ? 0.3 + pack * 0.35 : 0.08 + pack * 0.4;
  let x = 0;
  radii.forEach((r, i) => {
    if (i > 0) x += (radii[i - 1] + r) * (1 - overlap);
    out.push({ x, y: (i % 2 ? 1 : -1) * r * 0.18, r });
  });
  return out;
}

/** Centra el grupo y lo achica si no entra en `fit` del cuadro. */
function center(shapes: Shape[], w: number, h: number, sx = 1.18, fit = 0.84): Shape[] {
  const minX = Math.min(...shapes.map((q) => q.x - q.r * sx));
  const maxX = Math.max(...shapes.map((q) => q.x + q.r * sx));
  const minY = Math.min(...shapes.map((q) => q.y - q.r));
  const maxY = Math.max(...shapes.map((q) => q.y + q.r));
  const k = Math.min(1, (fit * w) / (maxX - minX), (fit * h) / (maxY - minY));
  const mx = (minX + maxX) / 2;
  const my = (minY + maxY) / 2;
  return shapes.map((q) => ({ x: w / 2 + (q.x - mx) * k, y: h / 2 + (q.y - my) * k, r: q.r * k }));
}

const easeInOut = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export const datoGrande = modeTool({
  id: 'dato-grande',
  name: 'Dato Grande',
  params: {
    layout: select('layout', 'barras', ['discos', 'venn', 'barras', 'pack']),
    values: text('valores (3–6)', '59%, 28%, 39%, 8%'),
    scale: num('escala', 0.7, 0.3, 1.2, 0.01),
    pack: num('juntas', 0.5, 0, 1, 0.01),
    labelSize: num('labels', 0.026, 0, 0.06, 0.002),
    grow: num('crecer', 1, 0, 1, 0.001),
    order: num('ordenar', 0, 0, 1, 0.001),
  },
  paint: { style: 'stipple', airbrush: 0.8, boil: 0.4, matrix: 'blue noise', cell: 2, pair: 'lilac/brown', ...EFFECTS_OFF },
  animations: {
    'Afiche (2 s)': { tracks: { grow: [[0, 0, 'linear'], [0.35, 1]] } },
    'Crece y ordena': { tracks: { grow: [[0, 0, 'linear'], [0.35, 1]], order: [[0.35, 0, 'inOut'], [0.6, 1]] } },
    'Discos': { values: { layout: 'discos' }, tracks: { grow: [[0, 0, 'linear'], [0.4, 1]] } },
    'Pack': { values: { layout: 'pack', values: '72, 24, 20, 15, 13, 11' }, tracks: { grow: [[0, 0, 'linear'], [0.4, 1]], order: [[0.4, 0, 'inOut'], [0.65, 1]] } },
  },
  presets: {
    Barras: { layout: 'barras', values: '59%, 28%, 39%, 8%' },
    Venn: { layout: 'venn', values: '33%, 24%, 14%, 49%' },
    Pack: { layout: 'pack', values: '72, 24, 20, 15, 13, 11' },
  },
  key: (p) => JSON.stringify([p.layout, p.values, p.scale, p.pack, p.labelSize, Math.round(n(p.grow) * 240), Math.round(n(p.order) * 240)]),
  draw({ fig, crisp, w, h }, p) {
    const data = parseValues(s(p.values));
    const vmax = Math.max(...data.map((d) => d.value));
    const layout = s(p.layout);
    const pack = n(p.pack);
    const unit = Math.min(w, h) * n(p.scale);
    const growAll = n(p.grow);
    const sortK = easeInOut(n(p.order));
    const sortedIdx = data.map((_, i) => i).sort((a, b) => data[b].value - data[a].value);
    // Cada forma crece con un pequeño desfasaje y un overshoot corto.
    const grow = (i: number) => (growAll >= 1 ? 1 : easeOutBack((growAll - i * 0.08) / Math.max(0.2, 1 - 0.08 * (data.length - 1))));
    const maxI = data.findIndex((d) => d.value === vmax);
    const labelPx = Math.min(w, h) * n(p.labelSize);
    const showNumeral = growAll >= 0.6;
    const density = (d: Datum) => Math.max(0.12, d.value / vmax);
    const gray = (k: number) => {
      const c = Math.round(255 * Math.min(1, k));
      return `rgb(${c},${c},${c})`;
    };
    fig.globalCompositeOperation = 'lighter';
    crisp.fillStyle = '#fff';
    crisp.font = font(500, labelPx);
    crisp.textAlign = 'center';
    crisp.textBaseline = 'middle';

    if (layout === 'barras') {
      const bw = unit * 0.2;
      const gap = bw * (0.08 + (1 - pack) * 0.5);
      const hmax = unit * 0.95;
      const slot = (k: number) => k * (bw + gap);
      const x0 = w / 2 - (slot(data.length - 1) + bw) / 2;
      const base = h / 2 + hmax / 2;
      const rank: number[] = [];
      sortedIdx.forEach((i, k) => (rank[i] = k));
      data.forEach((d, i) => {
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
        if (!showNumeral) return;
        if (i === maxI) {
          fig.globalCompositeOperation = 'source-over';
          fig.fillStyle = '#000';
          const px = fitFont(fig, d.token, 700, bw * 0.78);
          drawCentered(fig, d.token, 700, px, x + bw / 2, base - bh + bw * 0.75 + px * 0.35);
          fig.globalCompositeOperation = 'lighter';
        } else if (labelPx > 0) {
          crisp.fillText(d.token, x + bw / 2, base - bh - labelPx * 0.8);
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
    const to = sortK > 0 ? place(sortedIdx) : from;
    data.forEach((d, i) => {
      const x = from[i].x + (to[i].x - from[i].x) * sortK;
      const y = from[i].y + (to[i].y - from[i].y) * sortK;
      const rFit = from[i].r + (to[i].r - from[i].r) * sortK;
      const r = Math.max(0, rFit * grow(i));
      fig.fillStyle = gray(density(d));
      fig.beginPath();
      if (layout === 'venn') fig.ellipse(x, y, r * 1.18, r * 0.82, (i % 2 ? 1 : -1) * 0.35, 0, Math.PI * 2);
      else fig.arc(x, y, r, 0, Math.PI * 2);
      fig.fill();
      if (!showNumeral) return;
      if (i === maxI) {
        fig.globalCompositeOperation = 'source-over';
        fig.fillStyle = '#000';
        drawCentered(fig, d.token, 700, fitFont(fig, d.token, 700, rFit * 1.15), x, y);
        fig.globalCompositeOperation = 'lighter';
      } else if (labelPx > 0) {
        const a = Math.atan2(y - h / 2, x - w / 2) || -Math.PI / 2;
        const rr = (layout === 'venn' ? rFit * 1.18 : rFit) + labelPx * 1.2;
        crisp.fillText(d.token, x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
    });
  },
  frame: () => modeFrame(),
});

// ---------------------------------------------------------------- C · Cruce

export const cruce = modeTool({
  id: 'cruce',
  name: 'Cruce',
  params: {
    value: text('numeral', '391'),
    weight: num('peso', 700, 400, 700, 1),
    scale: num('escala', 0.42, 0.15, 0.9, 0.01),
    posX: num('posición x', 0.5, 0, 1, 0.01),
    posY: num('posición y', 0.5, 0, 1, 0.01),
    hybridCell: num('celda híbrida', 0.024, 0.008, 0.06, 0.001),
    hybrid: num('híbrido', 0.62, 0, 1, 0.01),
    threshold: num('umbral (el dato)', 0.72, 0.05, 1, 0.01),
    reveal: num('revelado', 1, 0, 1, 0.001),
    angle: num('ángulo', 0, -90, 90, 1),
    knife: num('cuchilla', 0.38, -0.05, 1.05, 0.001),
    paper: num('grano de papel', 0.006, 0, 0.05, 0.001),
  },
  paint: { style: 'stipple', airbrush: 0.3, boil: 0, matrix: 'bayer', cell: 2, pair: 'acid/ink', ...EFFECTS_OFF },
  animations: {
    'Afiche (2 s)': { tracks: { reveal: [[0, 0, 'out'], [0.35, 1]], knife: [[0.35, 1.05, 'inOut'], [0.6, 0.38]] } },
    'Cuchilla que barre': { tracks: { knife: [[0, 1.05, 'inOut'], [1, -0.05]] } },
    'Umbral que sube': { tracks: { threshold: [[0, 0.05, 'inOut'], [0.8, 0.72]] } },
    'Gira el corte': { values: { knife: 0.5 }, tracks: { angle: [[0, -40, 'inOut'], [1, 40]] } },
  },
  key: (p) => JSON.stringify([p.value, p.weight, p.scale, p.posX, p.posY, p.hybridCell, p.hybrid, p.threshold]),
  draw({ fig, w, h }, p) {
    const value = s(p.value).trim() || '0';
    fig.fillStyle = '#fff';
    drawCentered(fig, value, n(p.weight), fitFont(fig, value, n(p.weight), w * n(p.scale)), n(p.posX) * w, (1 - n(p.posY)) * h);
    const img = fig.getImageData(0, 0, w, h);
    const { mask } = hybridMask(img.data, w, h, { cell: n(p.hybridCell) * Math.min(w, h), hybrid: n(p.hybrid) });
    // La densidad del relleno es el dato: el stipple la convierte en puntos.
    const k = Math.round(255 * n(p.threshold));
    for (let i = 0; i < mask.length; i++) {
      const c = mask[i] ? k : 0;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = c;
      img.data[i * 4 + 3] = 255;
    }
    fig.putImageData(img, 0, 0);
  },
  frame: (p) => modeFrame({ gain: n(p.reveal), knife: { angle: n(p.angle), phase: n(p.knife), soft: 0 }, paper: n(p.paper) }),
});

// ---------------------------------------------------------------- D · Campo Partido

export const campoPartido = modeTool({
  id: 'campo-partido',
  name: 'Campo Partido',
  params: {
    angle: num('ángulo', 0, -90, 90, 1),
    knife: num('cuchilla', 0.5, -0.05, 1.05, 0.001),
    softness: num('borde', 0, 0, 1, 0.01),
    typeOn: bool('type', true),
    text: text('texto', 'MOTION'),
  },
  paint: { airbrush: 1.2, grain: 22, boil: 0.6, pair: 'magenta/verde', ...EFFECTS_OFF },
  animations: {
    'Afiche (2 s)': { tracks: { knife: [[0, 1.05, 'inOut'], [0.5, 0.5]] } },
    'Cruza entero': { tracks: { knife: [[0, 1.05, 'inOut'], [1, -0.05]] } },
    'Gira': { values: { knife: 0.5 }, tracks: { angle: [[0, -35, 'inOut'], [1, 35]] } },
    'Borde que se ablanda': { values: { knife: 0.5 }, tracks: { softness: [[0, 0, 'inOut'], [1, 0.8]] } },
  },
  key: (p) => JSON.stringify([p.typeOn, p.text]),
  draw({ fig, w, h }, p) {
    const t = s(p.text).trim();
    if (!p.typeOn || !t) return;
    fig.fillStyle = '#fff';
    drawCentered(fig, t, 700, fitFont(fig, t, 700, w * 0.56), w / 2, h / 2);
  },
  frame: (p) => modeFrame({ knife: { angle: n(p.angle), phase: n(p.knife), soft: n(p.softness) } }),
});

// ---------------------------------------------------------------- E · Grano de Papel

export const granoPapel = modeTool({
  id: 'grano-papel',
  name: 'Grano de Papel',
  inputs: [{ id: 'photo', label: 'Foto', required: false }],
  params: {
    text: text('frase', "Motion isn't\ndecoration.\nIt's how things\nexplain themselves.", true),
    size: num('tamaño', 0.082, 0.03, 0.16, 0.002),
    density: num('grano de papel', 0.012, 0, 0.06, 0.001),
    grid: bool('grilla', true),
    enter: num('entrada', 1, 0, 1, 0.001),
  },
  paint: { airbrush: 0.6, grain: 14, boil: 0.3, ...EFFECTS_OFF },
  animations: {
    'Afiche (2 s)': {
      tracks: { enter: [[0, 0, 'out'], [0.1, 1]], density: [[0, 0.012, 'inOut'], [0.3, 0.022, 'inOut'], [0.6, 0.012]] },
    },
    'Solo grano': { values: { enter: 1 }, tracks: { density: [[0, 0, 'out'], [1, 0.03]] } },
    'Enfoca': { values: { enter: 1 }, tracks: { airbrush: [[0, 8, 'out'], [0.6, 0.6]] } },
  },
  key: (p) => JSON.stringify([p.text, p.size, p.grid]),
  draw({ fig, crisp, w, h }, p) {
    const unit = Math.min(w, h);
    if (p.grid) {
      // Retícula a opacidad baja: las 2 tintas la vuelven puntos sueltos.
      const step = unit / 22;
      crisp.strokeStyle = 'rgba(255,255,255,0.22)';
      crisp.lineWidth = Math.max(1, unit / 1080);
      crisp.beginPath();
      for (let x = (w % step) / 2; x <= w; x += step) {
        crisp.moveTo(Math.round(x) + 0.5, 0);
        crisp.lineTo(Math.round(x) + 0.5, h);
      }
      for (let y = (h % step) / 2; y <= h; y += step) {
        crisp.moveTo(0, Math.round(y) + 0.5);
        crisp.lineTo(w, Math.round(y) + 0.5);
      }
      crisp.stroke();
    }
    const lines = s(p.text).split('\n');
    const px = unit * n(p.size);
    const lh = px * 1.02;
    let y = h * 0.42 - (lh * (lines.length - 1)) / 2;
    fig.fillStyle = '#fff';
    fig.textAlign = 'left';
    fig.textBaseline = 'middle';
    fig.font = font(700, px);
    for (const line of lines) {
      fig.fillText(line, w * 0.08, y);
      y += lh;
    }
  },
  frame: (p, ctx) => modeFrame({ progress: n(p.enter), photo: ctx.inputs.photo ? 1 : 0, paper: n(p.density) }),
});

// ---------------------------------------------------------------- F · Órbita

function titleLines(t: string): string[] {
  return t
    .split(/\s+(?=\+)/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export const orbita = modeTool({
  id: 'orbita',
  name: 'Órbita',
  params: {
    text: text('texto', 'Human + Motion'),
    rings: num('anillos', 2, 1, 4, 1),
    radius: num('radio', 0.34, 0.15, 0.48, 0.01),
    tracking: num('tracking', 0.82, 0.3, 1, 0.01),
    spin: num('giro (vueltas)', 0, -2, 2, 0.001),
    title: bool('título al centro', true),
  },
  paint: { airbrush: 1, grain: 20, boil: 0.6, ...EFFECTS_OFF },
  animations: {
    // El resorte es el ease "back": entra girando y frena con un overshoot corto.
    'Afiche (2 s)': { tracks: { spin: [[0, 0.6, 'back'], [0.6, 0]] } },
    'Gira lento': { tracks: { spin: [[0, 0, 'linear'], [1, 1]] } },
    'Se abre': { tracks: { radius: [[0, 0.18, 'back'], [0.6, 0.34]], spin: [[0, -0.4, 'back'], [0.6, 0]] } },
  },
  key: (p) => JSON.stringify([p.text, p.rings, p.radius, p.tracking, Math.round(n(p.spin) * 2000), p.title]),
  draw({ fig, crisp, w, h }, p) {
    const unit = Math.min(w, h);
    const cx = w / 2;
    const cy = h / 2;
    const t = s(p.text);
    if (p.title) {
      const lines = titleLines(t);
      const widest = lines.reduce((a, b) => (b.length > a.length ? b : a), '');
      const px = Math.min(fitFont(fig, widest, 700, unit * 0.5), unit * 0.16);
      fig.fillStyle = '#fff';
      lines.forEach((line, i) => drawCentered(fig, line, 700, px, cx, cy + (i - (lines.length - 1) / 2) * px * 0.98));
    }
    const letters = [...t.replace(/[^\p{L}\p{N}]/gu, '')];
    const rings = Math.max(1, Math.round(n(p.rings)));
    const radius = unit * n(p.radius);
    const bead = unit * 0.024;
    crisp.strokeStyle = '#fff';
    crisp.fillStyle = '#fff';
    crisp.lineWidth = Math.max(1, unit / 1080);
    const per = Math.ceil(letters.length / rings);
    for (let r = 0; r < rings; r++) {
      const rx = radius * (1 - r * 0.14) * 1.12;
      const ry = rx * 0.58;
      const rot = -0.35 + r * 0.95;
      crisp.beginPath();
      crisp.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      crisp.stroke();
      const mine = letters.slice(r * per, (r + 1) * per);
      const dir = r % 2 ? -1 : 1;
      const phase = dir * Math.PI * 2 * n(p.spin) * (1 + 0.3 * r) - Math.PI / 2 + r * 0.6;
      mine.forEach((ch, k) => {
        const a = phase + (k / Math.max(1, mine.length)) * Math.PI * 2 * n(p.tracking);
        const ex = Math.cos(a) * rx;
        const ey = Math.sin(a) * ry;
        const x = cx + ex * Math.cos(rot) - ey * Math.sin(rot);
        const y = cy + ex * Math.sin(rot) + ey * Math.cos(rot);
        crisp.save();
        crisp.globalCompositeOperation = 'destination-out';
        crisp.beginPath();
        crisp.arc(x, y, bead, 0, Math.PI * 2);
        crisp.fill();
        crisp.restore();
        crisp.beginPath();
        crisp.arc(x, y, bead, 0, Math.PI * 2);
        crisp.stroke();
        crisp.font = font(500, bead * 1.15);
        crisp.textAlign = 'center';
        crisp.textBaseline = 'middle';
        crisp.fillText(ch, x, y + bead * 0.06);
      });
    }
  },
  frame: () => modeFrame(),
});

// ---------------------------------------------------------------- G · Dither Field (propuesta)

export const ditherField = modeTool({
  id: 'dither-field',
  name: 'Dither Field',
  params: {
    threshold: num('densidad de la palabra', 0.86, 0.3, 1, 0.01),
    typeOn: bool('type', true),
    text: text('texto', 'SIGNAL'),
    sort: bool('ordenar puntos', false),
    sweep: num('barrido', 1.04, 0, 1.04, 0.001),
  },
  paint: { style: 'stipple', airbrush: 0, grain: 0, boil: 0, matrix: 'blue noise', cell: 3, ...EFFECTS_OFF },
  animations: {
    'Afiche (2 s)': { tracks: { sweep: [[0, 0, 'inOut'], [0.4, 1.04]] } },
    'Umbral': { values: { sweep: 1.04 }, tracks: { threshold: [[0, 0.3, 'inOut'], [0.8, 0.9]] } },
    'Barrido ordenado': { values: { sort: true }, tracks: { sweep: [[0, 0, 'inOut'], [0.6, 1.04]] } },
  },
  key: (p) => JSON.stringify([p.typeOn, p.text, p.threshold]),
  draw({ fig, w, h }, p) {
    // Campo: un gradiente bajo de densidad. La palabra solo se distingue por su densidad.
    const g = fig.createLinearGradient(0, h, w, 0);
    g.addColorStop(0, 'rgb(20,20,20)');
    g.addColorStop(1, 'rgb(107,107,107)');
    fig.fillStyle = g;
    fig.fillRect(0, 0, w, h);
    const t = s(p.text).trim();
    if (!p.typeOn || !t) return;
    const k = Math.round(255 * n(p.threshold));
    fig.fillStyle = `rgb(${k},${k},${k})`;
    drawCentered(fig, t, 700, fitFont(fig, t, 700, w * 0.78), w / 2, h / 2);
  },
  frame: (p) => modeFrame({ progress: n(p.sweep), reveal: 1, sort: Boolean(p.sort) }),
});

export const MODE_TOOLS = [unaPalabra, datoGrande, cruce, campoPartido, granoPapel, orbita, ditherField];
