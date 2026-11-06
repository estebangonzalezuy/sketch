import { defineTool, type Params, type RenderContext } from '../../core/tool';
import { clamp01, createCanvasLayer, fontsReady, stepIn } from '../shared/canvasLayer';
import animations from './animations';
import presets from './presets.json';

export type Row = { kind: 'group'; label: string } | { kind: 'row'; cells: { text: string; best: boolean }[] };

/** Primera línea: encabezados. `# Grupo` abre una sección. `*valor` marca el mejor de la fila. */
export function parseTable(text: string) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const header = (lines[0] ?? '').split('|').map((s) => s.trim());
  const rows: Row[] = lines.slice(1).map((line) =>
    line.startsWith('#')
      ? { kind: 'group', label: line.replace(/^#\s*/, '') }
      : { kind: 'row', cells: line.split('|').map((s) => s.trim()).map((s) => ({ text: s.replace(/^\*/, ''), best: s.startsWith('*') })) },
  );
  return { header, rows };
}

const num = (p: Params, id: string) => p[id] as number;

export default defineTool({
  id: 'table',
  name: 'Tabla',
  version: 1,
  kind: 'generator',
  inputs: [],
  presets,
  animations,
  params: {
    data: { kind: 'text', default: 'Métrica | A | B | C\n# Grupo\nVelocidad | *120 | 80 | 64\nCalidad | 71 | *88 | 80\nCosto | *$1 | $2 | $3', multiline: true, label: 'datos', animate: 'none', group: 'Contenido' },
    title: { kind: 'text', default: 'Título de la tabla', label: 'título', animate: 'none', group: 'Contenido' },
    subtitle: { kind: 'text', default: 'Subtítulo', label: 'subtítulo', animate: 'none', group: 'Contenido' },
    highlightColumn: { kind: 'number', default: 1, min: 0, max: 8, step: 1, label: 'columna destacada', animate: 'none', group: 'Contenido' },
    family: { kind: 'select', default: 'KMR Apparat', options: ['KMR Apparat', 'Archivo Narrow', 'Geist Mono'], animate: 'none', group: 'Contenido' },
    labelFamily: { kind: 'select', default: 'KMR Apparat', options: ['KMR Apparat', 'Archivo Narrow', 'Geist Mono'], label: 'fuente de etiquetas', animate: 'none', group: 'Contenido' },

    reveal: { kind: 'number', default: 1, min: 0, max: 1, step: 0.001, label: 'filas', animate: 'frame', group: 'Animación' },
    stagger: { kind: 'number', default: 0.7, min: 0, max: 0.95, step: 0.01, animate: 'frame', group: 'Animación' },
    header: { kind: 'number', default: 1, min: 0, max: 1, step: 0.001, label: 'encabezado', animate: 'frame', group: 'Animación' },
    highlight: { kind: 'number', default: 1, min: 0, max: 1, step: 0.001, label: 'columna', animate: 'frame', group: 'Animación' },
    dim: { kind: 'number', default: 0, min: 0, max: 1, step: 0.001, label: 'atenuar el resto', animate: 'frame', group: 'Animación' },

    background: { kind: 'boolean', default: true, label: 'fondo', animate: 'frame', group: 'Color' },
    ground: { kind: 'color', default: '#FAF7EF', label: 'fondo', animate: 'frame', group: 'Color' },
    ink: { kind: 'color', default: '#1F2422', label: 'tinta', animate: 'frame', group: 'Color' },
    muted: { kind: 'color', default: '#7C827F', label: 'secundario', animate: 'frame', group: 'Color' },
    accent: { kind: 'color', default: '#3F9C9C', label: 'acento', animate: 'frame', group: 'Color' },
    band: { kind: 'color', default: '#E9F0E9', label: 'columna', animate: 'frame', group: 'Color' },
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
        const { header, rows } = parseTable(String(p.data));
        const family = p.family as string;
        const [ink, muted, accent] = [p.ink as string, p.muted as string, p.accent as string];
        const headerAmount = num(p, 'header');
        const dim = num(p, 'dim');
        const hi = num(p, 'highlightColumn');

        if (p.background) {
          c.fillStyle = p.ground as string;
          c.fillRect(0, 0, w, h);
        }

        const left = w * 0.07;
        const right = w * 0.93;
        const top = h * 0.2;
        const bottom = h * 0.95;
        const columns = Math.max(1, header.length - 1);
        const firstWidth = (right - left) * 0.42;
        const columnWidth = (right - left - firstWidth) / columns;
        const units = rows.reduce((s, r) => s + (r.kind === 'group' ? 1.5 : 1), 1.6);
        const rowH = (bottom - top) / units;
        const size = Math.min(rowH * 0.6, 34);
        const colX = (i: number) => left + firstWidth + columnWidth * (i - 1);

        c.textBaseline = 'alphabetic';
        c.textAlign = 'left';
        c.globalAlpha = headerAmount;
        c.fillStyle = accent;
        c.fillRect(w * 0.07, h * 0.07, 5, 36 * headerAmount);
        c.fillStyle = ink;
        c.font = `700 36px "${family}"`;
        c.fillText(String(p.title), w * 0.07 + 20, h * 0.07 + 30);
        c.fillStyle = muted;
        c.font = `400 25px "${family}"`;
        c.fillText(String(p.subtitle), w * 0.07 + 20, h * 0.07 + 66);

        // Columna destacada: crece desde el encabezado.
        const highlight = num(p, 'highlight');
        if (hi >= 1 && hi <= columns && highlight > 0) {
          const height = (bottom - top) * (1 - (1 - clamp01(highlight)) ** 3);
          c.globalAlpha = 1;
          c.fillStyle = p.band as string;
          c.fillRect(colX(hi) - 16, top - 8, columnWidth - 8, height);
          c.strokeStyle = accent;
          c.lineWidth = 2;
          c.setLineDash([3, 5]);
          c.strokeRect(colX(hi) - 16, top - 8, columnWidth - 8, height);
          c.setLineDash([]);
        }

        c.globalAlpha = headerAmount;
        c.fillStyle = ink;
        c.font = `400 ${size * 0.72}px "${p.labelFamily}"`;
        header.slice(1).forEach((label, i) => c.fillText(label.toUpperCase(), colX(i + 1), top + rowH * 0.8));

        const stagger = num(p, 'stagger');
        let y = top + rowH * 1.6;
        const span = 1 - stagger;
        rows.forEach((row, i) => {
          const a = stepIn(num(p, 'reveal'), rows.length > 1 ? (i / (rows.length - 1)) * stagger : 0, span);
          const rise = (1 - a) * 14;
          if (row.kind === 'group') {
            y += rowH * 1.5;
            c.globalAlpha = a;
            c.fillStyle = muted;
            c.font = `400 ${size * 0.62}px "${p.labelFamily}"`;
            c.fillText(row.label.toUpperCase(), left, y - rowH * 0.25 + rise);
            return;
          }
          y += rowH;
          row.cells.forEach((cell, col) => {
            const inColumn = col === hi;
            c.globalAlpha = a * (col > 0 && !inColumn ? 1 - dim * 0.7 : 1);
            c.fillStyle = col === 0 || cell.best ? ink : muted;
            c.font = `${cell.best ? 700 : 400} ${size}px "${family}"`;
            c.fillText(cell.text, col === 0 ? left : colX(col), y - rowH * 0.25 + rise);
          });
        });
        layer.end(ctx);
      },
      dispose() {
        layer.dispose();
      },
    };
  },
});
