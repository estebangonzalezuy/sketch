import { defineTool, type Params, type RenderContext } from '../../core/tool';
import { clamp01, createCanvasLayer, fontsReady, stepIn } from '../shared/canvasLayer';
import animations from './animations';
import presets from './presets.json';

type Point = { label: string; x: number; y: number; over: string; note: string; side: string };

/** Una línea por punto: etiqueta | x | y | sobretítulo | nota | lado: l o r, más u (arriba) o d (abajo). */
export function parseData(text: string): Point[] {
  return text
    .split('\n')
    .map((line) => line.split('|').map((s) => s.trim()))
    .filter((f) => f.length >= 3 && Number.isFinite(Number(f[1])) && Number.isFinite(Number(f[2])))
    .map(([label, x, y, over = '', note = '', side = 'l']) => ({ label, x: Number(x), y: Number(y), over, note, side }));
}

/** Marcas redondas del eje: 1, 2 o 5 por potencia de 10. */
export function niceTicks(min: number, max: number, count = 5) {
  const raw = (max - min || 1) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].find((s) => s * power >= raw)! * power;
  const from = Math.floor(min / step) * step;
  const to = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let i = 0; from + i * step <= to + step * 1e-6; i++) ticks.push(from + i * step);
  return ticks;
}

export const decades = (min: number, max: number) => {
  const ticks: number[] = [];
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) ticks.push(10 ** e);
  return ticks;
};

const num = (p: Params, id: string) => p[id] as number;

export default defineTool({
  id: 'chart',
  name: 'Chart',
  version: 1,
  kind: 'generator',
  inputs: [],
  presets,
  animations,
  params: {
    data: { kind: 'text', default: 'Ene | 1 | 12\nFeb | 2 | 18\nMar | 3 | 15\nAbr | 4 | 26\nMay | 5 | 38', multiline: true, label: 'datos', animate: 'none', group: 'Contenido' },
    title: { kind: 'text', default: 'Título del chart', label: 'título', animate: 'none', group: 'Contenido' },
    subtitle: { kind: 'text', default: 'Subtítulo', label: 'subtítulo', animate: 'none', group: 'Contenido' },
    xLabel: { kind: 'text', default: '', label: 'eje x', animate: 'none', group: 'Contenido' },
    yLabel: { kind: 'text', default: '', label: 'eje y', animate: 'none', group: 'Contenido' },
    xSuffix: { kind: 'text', default: '', label: 'sufijo x', animate: 'none', group: 'Contenido' },

    type: { kind: 'select', default: 'path', options: ['path', 'bars', 'scatter'], animate: 'none', group: 'Forma' },
    xScale: { kind: 'select', default: 'linear', options: ['linear', 'log'], animate: 'none', group: 'Forma' },
    family: { kind: 'select', default: 'KMR Apparat', options: ['KMR Apparat', 'Archivo Narrow', 'Geist Mono'], animate: 'none', group: 'Forma' },
    labelFamily: { kind: 'select', default: 'KMR Apparat', options: ['KMR Apparat', 'Archivo Narrow', 'Geist Mono'], label: 'fuente de etiquetas', animate: 'none', group: 'Forma' },
    lineWidth: { kind: 'number', default: 3, min: 1, max: 12, step: 0.5, animate: 'frame', group: 'Forma' },
    pointSize: { kind: 'number', default: 8, min: 2, max: 30, step: 0.5, animate: 'frame', group: 'Forma' },

    progress: { kind: 'number', default: 1, min: 0, max: 1, step: 0.001, label: 'avance', animate: 'frame', group: 'Animación' },
    axes: { kind: 'number', default: 1, min: 0, max: 1, step: 0.001, label: 'ejes y títulos', animate: 'frame', group: 'Animación' },
    labels: { kind: 'number', default: 1, min: 0, max: 1, step: 0.001, label: 'etiquetas', animate: 'frame', group: 'Animación' },
    focus: { kind: 'number', default: 0, min: 0, max: 1, step: 0.001, label: 'foco en el último', animate: 'frame', group: 'Animación' },

    background: { kind: 'boolean', default: true, label: 'fondo', animate: 'frame', group: 'Color' },
    ground: { kind: 'color', default: '#F8F6EE', label: 'fondo', animate: 'frame', group: 'Color' },
    ink: { kind: 'color', default: '#1F2422', label: 'tinta', animate: 'frame', group: 'Color' },
    muted: { kind: 'color', default: '#7C827F', label: 'secundario', animate: 'frame', group: 'Color' },
    accent: { kind: 'color', default: '#3F9C9C', label: 'acento', animate: 'frame', group: 'Color' },
  },
  create() {
    const layer = createCanvasLayer();
    const { c } = layer;

    return {
      async prepare(p: Params) {
        await fontsReady([`700 40px "${p.family}"`, `400 40px "${p.family}"`, `400 20px "${p.labelFamily}"`]);
      },
      render(p: Params, ctx: RenderContext) {
        const { w, h } = layer.begin(ctx);
        const points = parseData(String(p.data));
        const family = p.family as string;
        const type = p.type as string;
        const axes = num(p, 'axes');
        const progress = num(p, 'progress');
        const labels = num(p, 'labels');
        const focus = num(p, 'focus');
        const [ink, muted, accent] = [p.ink as string, p.muted as string, p.accent as string];

        if (p.background) {
          c.fillStyle = p.ground as string;
          c.fillRect(0, 0, w, h);
        }

        const sans = (size: number, weight = 400) => `${weight} ${size}px "${family}"`;
        const mono = (size: number) => `400 ${size}px "${p.labelFamily}"`;
        const box = { left: w * 0.1, right: w * 0.93, top: h * 0.2, bottom: h * 0.84 };

        // Título, con la marca de acento del blog.
        c.globalAlpha = axes;
        c.fillStyle = accent;
        c.fillRect(w * 0.06, h * 0.075, 5, 36 * axes);
        c.fillStyle = ink;
        c.textBaseline = 'alphabetic';
        c.textAlign = 'left';
        c.font = sans(36, 700);
        c.fillText(String(p.title), w * 0.06 + 20, h * 0.075 + 30);
        c.fillStyle = muted;
        c.font = sans(25);
        c.fillText(String(p.subtitle), w * 0.06 + 20, h * 0.075 + 66);

        if (points.length === 0) {
          layer.end(ctx);
          return;
        }

        const log = p.xScale === 'log' && points.every((pt) => pt.x > 0);
        const xs = points.map((pt) => pt.x);
        const ys = points.map((pt) => pt.y);
        const yTicks = niceTicks(type === 'bars' ? Math.min(0, ...ys) : Math.min(...ys), Math.max(...ys));
        const yMin = yTicks[0];
        const yMax = yTicks[yTicks.length - 1];
        const xTicks = log ? decades(Math.min(...xs), Math.max(...xs)) : niceTicks(Math.min(...xs), Math.max(...xs));
        const f = (v: number) => (log ? Math.log10(v) : v);
        // En log, el aire sale de los datos y no de la década entera: las etiquetas necesitan lugar a la izquierda.
        const dataSpan = f(Math.max(...xs)) - f(Math.min(...xs)) || 1;
        const [x0, x1] = log ? [f(Math.min(...xs)) - dataSpan * 0.42, f(Math.max(...xs)) + dataSpan * 0.3] : [f(xTicks[0]), f(xTicks[xTicks.length - 1])];
        const pad = type === 'bars' ? 0 : 0.03;
        const sx = (v: number) => box.left + (box.right - box.left) * (pad + (1 - 2 * pad) * ((f(v) - x0) / (x1 - x0 || 1)));
        const sy = (v: number) => box.bottom - (box.bottom - box.top) * ((v - yMin) / (yMax - yMin || 1));

        // Grilla punteada y ejes.
        c.globalAlpha = axes;
        c.lineWidth = 1.5;
        c.strokeStyle = muted;
        c.setLineDash([2, 7]);
        c.font = mono(21);
        c.fillStyle = muted;
        for (const t of yTicks) {
          c.beginPath();
          c.moveTo(box.left, sy(t));
          c.lineTo(box.right, sy(t));
          c.stroke();
          c.textAlign = 'right';
          c.textBaseline = 'middle';
          c.fillText(String(+t.toFixed(4)), box.left - 16, sy(t));
        }
        if (type !== 'bars') {
          for (const t of xTicks.filter((v) => f(v) >= x0 && f(v) <= x1)) {
            c.beginPath();
            c.moveTo(sx(t), box.top);
            c.lineTo(sx(t), box.bottom);
            c.stroke();
            c.textAlign = 'center';
            c.textBaseline = 'top';
            c.fillText(`${+t.toFixed(4)}${p.xSuffix}`, sx(t), box.bottom + 14);
          }
        }
        c.setLineDash([]);
        c.font = sans(23);
        c.textAlign = 'center';
        c.textBaseline = 'alphabetic';
        c.fillText(String(p.xLabel), (box.left + box.right) / 2, h * 0.94);
        c.save();
        c.translate(w * 0.038, (box.top + box.bottom) / 2);
        c.rotate(-Math.PI / 2);
        c.fillText(String(p.yLabel), 0, 0);
        c.restore();

        const label = (pt: Point, i: number, x: number, y: number, amount: number) => {
          if (amount <= 0 || !pt.label) return;
          const last = i === points.length - 1;
          const right = pt.side.includes('r');
          const dy = pt.side.includes('u') ? -34 : pt.side.includes('d') ? 40 : 0;
          const gx = x + (right ? 1 : -1) * (num(p, 'pointSize') + 16);
          const rise = (1 - amount) * 14 + dy;
          c.globalAlpha = amount * (focus > 0 && !last ? 1 - focus * 0.75 : 1);
          c.textAlign = right ? 'left' : 'right';
          c.textBaseline = 'alphabetic';
          c.fillStyle = muted;
          c.font = mono(19);
          if (pt.over) c.fillText(pt.over, gx, y - 30 + rise);
          c.fillStyle = last ? accent : ink;
          c.font = sans(32, 700);
          c.fillText(pt.label, gx, y + 2 + rise);
          c.fillStyle = muted;
          c.font = sans(23);
          if (pt.note) c.fillText(pt.note, gx, y + 30 + rise);
        };

        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.lineWidth = num(p, 'lineWidth');

        if (type === 'bars') {
          const slot = (box.right - box.left) / points.length;
          const span = 0.5;
          points.forEach((pt, i) => {
            const a = stepIn(progress, (i / points.length) * (1 - span), span);
            const x = box.left + slot * (i + 0.5);
            const top = sy(pt.y);
            const base = sy(Math.max(0, yMin));
            const height = (base - top) * a;
            c.globalAlpha = focus > 0 && i !== points.length - 1 ? 1 - focus * 0.65 : 1;
            c.fillStyle = i === points.length - 1 ? accent : ink;
            c.fillRect(x - slot * 0.32, base - height, slot * 0.64, height);
            c.globalAlpha = a * labels;
            c.fillStyle = ink;
            c.font = sans(28, 700);
            c.textAlign = 'center';
            c.textBaseline = 'alphabetic';
            c.fillText(String(+pt.y.toFixed(2)), x, base - height - 12);
            c.fillStyle = muted;
            c.font = mono(20);
            c.textBaseline = 'top';
            c.fillText(pt.label, x, box.bottom + 14);
          });
          layer.end(ctx);
          return;
        }

        const screen = points.map((pt) => ({ x: sx(pt.x), y: sy(pt.y) }));

        if (type === 'path') {
          // Largo acumulado: la línea avanza a velocidad pareja y cada punto aparece cuando llega.
          const lengths = [0];
          for (let i = 1; i < screen.length; i++) lengths[i] = lengths[i - 1] + Math.hypot(screen[i].x - screen[i - 1].x, screen[i].y - screen[i - 1].y);
          const total = lengths[lengths.length - 1] || 1;
          const reached = progress * total;

          c.globalAlpha = 1 - focus * 0.4;
          c.strokeStyle = accent;
          c.fillStyle = accent;
          for (let i = 1; i < screen.length; i++) {
            const part = clamp01((reached - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1));
            if (part <= 0) break;
            const [a, b] = [screen[i - 1], screen[i]];
            const trim = Math.min(num(p, 'pointSize') + 6, (lengths[i] - lengths[i - 1]) / 3);
            const size = lengths[i] - lengths[i - 1] || 1;
            const [ux, uy] = [(b.x - a.x) / size, (b.y - a.y) / size];
            const end = { x: a.x + ux * Math.max(0, size * part - (part === 1 ? trim : 0)), y: a.y + uy * Math.max(0, size * part - (part === 1 ? trim : 0)) };
            c.beginPath();
            c.moveTo(a.x, a.y);
            c.lineTo(end.x, end.y);
            c.stroke();
            // Punta de flecha, como en el chart de referencia.
            const head = 13;
            const angle = Math.atan2(uy, ux);
            c.beginPath();
            c.moveTo(end.x - head * Math.cos(angle - 0.5), end.y - head * Math.sin(angle - 0.5));
            c.lineTo(end.x, end.y);
            c.lineTo(end.x - head * Math.cos(angle + 0.5), end.y - head * Math.sin(angle + 0.5));
            c.stroke();
          }

          points.forEach((pt, i) => {
            const at = lengths[i] / total;
            const a = stepIn(progress, at * 0.95, 0.05); // el último llega justo en 1
            const last = i === points.length - 1;
            c.globalAlpha = (progress > 0 ? 1 : 0) * (focus > 0 && !last ? 1 - focus * 0.5 : 1);
            c.fillStyle = accent;
            c.beginPath();
            c.arc(screen[i].x, screen[i].y, (last ? 1.35 + focus * 0.5 : 1) * num(p, 'pointSize') * a, 0, Math.PI * 2);
            c.fill();
            label(pt, i, screen[i].x, screen[i].y, a * labels);
          });
        } else {
          points.forEach((pt, i) => {
            const last = i === points.length - 1;
            const a = stepIn(progress, (i / points.length) * 0.7, 0.3);
            c.globalAlpha = focus > 0 && !last ? 1 - focus * 0.65 : 1;
            c.fillStyle = last ? accent : ink;
            c.beginPath();
            c.arc(screen[i].x, screen[i].y, num(p, 'pointSize') * a, 0, Math.PI * 2);
            c.fill();
            label(pt, i, screen[i].x, screen[i].y, a * labels);
          });
        }
        layer.end(ctx);
      },
      dispose() {
        layer.dispose();
      },
    };
  },
});
