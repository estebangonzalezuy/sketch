import { defineTool, type Params, type RenderContext } from '../../core/tool';
import { clamp01, createCanvasLayer, fontsReady } from '../shared/canvasLayer';
import animations from './animations';
import presets from './presets.json';

const num = (p: Params, id: string) => p[id] as number;

export function formatValue(value: number, decimals: number, separator: string) {
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole, fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, separator === 'ninguno' ? '' : separator);
  return `${value < 0 ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/** Posición continua del dígito de una potencia de 10: gira solo cuando el dígito menor pasa de 9 a 0. */
export function digitPosition(value: number, power: number) {
  const whole = Math.floor(value / power);
  if (power <= 0) return value;
  const below = (value / power - whole) * 10;
  return whole + Math.max(0, below - 9);
}

export default defineTool({
  id: 'counter',
  name: 'Contador',
  version: 1,
  kind: 'generator',
  inputs: [],
  presets,
  animations,
  params: {
    from: { kind: 'number', default: 0, min: -1000000, max: 10000000, step: 1, label: 'desde', animate: 'none', group: 'Valor' },
    to: { kind: 'number', default: 1068, min: -1000000, max: 10000000, step: 1, label: 'hasta', animate: 'none', group: 'Valor' },
    decimals: { kind: 'number', default: 0, min: 0, max: 4, step: 1, label: 'decimales', animate: 'none', group: 'Valor' },
    separator: { kind: 'select', default: ',', options: [',', '.', ' ', 'ninguno'], label: 'miles', animate: 'none', group: 'Valor' },
    prefix: { kind: 'text', default: '', label: 'prefijo', animate: 'none', group: 'Valor' },
    suffix: { kind: 'text', default: '', label: 'sufijo', animate: 'none', group: 'Valor' },
    caption: { kind: 'text', default: 'tokens por segundo', label: 'leyenda', animate: 'none', group: 'Valor' },

    mode: { kind: 'select', default: 'count', options: ['count', 'odometer'], label: 'modo', animate: 'none', group: 'Tipo' },
    family: { kind: 'select', default: 'KMR Apparat', options: ['KMR Apparat', 'Archivo Narrow', 'Geist Mono'], animate: 'none', group: 'Tipo' },
    weight: { kind: 'number', default: 700, min: 400, max: 700, step: 100, animate: 'none', group: 'Tipo' },
    size: { kind: 'number', default: 320, min: 20, max: 900, animate: 'frame', group: 'Tipo' },
    align: { kind: 'select', default: 'center', options: ['left', 'center', 'right'], animate: 'none', group: 'Tipo' },
    position: { kind: 'vec2', default: [0.5, 0.5], min: 0, max: 1, animate: 'frame', group: 'Tipo' },

    progress: { kind: 'number', default: 1, min: 0, max: 1, step: 0.001, label: 'avance', animate: 'frame', group: 'Animación' },
    fade: { kind: 'number', default: 1, min: 0, max: 1, step: 0.001, label: 'aparición', animate: 'frame', group: 'Animación' },
    scale: { kind: 'number', default: 1, min: 0.2, max: 3, step: 0.001, label: 'escala', animate: 'frame', group: 'Animación' },
    captionReveal: { kind: 'number', default: 1, min: 0, max: 1, step: 0.001, label: 'leyenda', animate: 'frame', group: 'Animación' },

    color: { kind: 'color', default: '#FFFFFF', animate: 'frame', group: 'Color' },
    captionColor: { kind: 'color', default: '#A7ADAA', label: 'leyenda', animate: 'frame', group: 'Color' },
  },
  create() {
    const layer = createCanvasLayer();
    const { c } = layer;

    return {
      async prepare(p: Params) {
        await fontsReady([`${p.weight} 100px "${p.family}"`]);
      },
      render(p: Params, ctx: RenderContext) {
        const { w, h } = layer.begin(ctx);
        const [from, to] = [num(p, 'from'), num(p, 'to')];
        const decimals = num(p, 'decimals');
        const value = from + (to - from) * clamp01(num(p, 'progress'));
        const size = num(p, 'size') * num(p, 'scale');
        const [px, py] = p.position as [number, number];
        const separator = p.separator as string;
        const prefix = String(p.prefix);
        const suffix = String(p.suffix);

        // El ancho sale del valor final: el bloque no baila mientras cuenta.
        const finalText = formatValue(Math.max(Math.abs(from), Math.abs(to)), decimals, separator);
        c.font = `${p.weight} ${size}px "${p.family}"`;
        c.textBaseline = 'alphabetic';
        c.textAlign = 'left';
        const digit = Math.max(...'0123456789'.split('').map((d) => c.measureText(d).width));
        const glyphW = (ch: string) => (/\d/.test(ch) ? digit : c.measureText(ch).width);
        const totalW = [...prefix, ...finalText, ...suffix].reduce((s, ch) => s + glyphW(ch), 0);
        const x0 = px * w - (p.align === 'center' ? totalW / 2 : p.align === 'right' ? totalW : 0);
        const baseline = py * h + size * 0.34;

        const opacity = clamp01(num(p, 'fade'));
        c.globalAlpha = opacity;
        c.fillStyle = p.color as string;
        let x = x0;
        for (const ch of prefix) {
          c.fillText(ch, x, baseline);
          x += glyphW(ch);
        }

        const text = formatValue(value, decimals, separator);
        const pad = finalText.length - text.length;
        if (p.mode === 'odometer') {
          // Tira de dígitos recortada a una ventana, por posición.
          const scaled = Math.abs(value) * 10 ** decimals;
          let place = (finalText.match(/\d/g) ?? []).length - 1;
          for (const ch of finalText) {
            if (!/\d/.test(ch)) {
              c.globalAlpha = opacity * clamp01(digitPosition(scaled, 10 ** (place + 1)));
              c.fillText(ch, x, baseline);
              c.globalAlpha = opacity;
              x += glyphW(ch);
              continue;
            }
            const position = digitPosition(scaled, 10 ** place);
            const base = Math.floor(position);
            c.save();
            // Sin ceros de relleno a la izquierda.
            c.globalAlpha = opacity * (place === 0 ? 1 : clamp01(position));
            c.beginPath();
            c.rect(x, baseline - size * 0.85, digit, size * 1.05);
            c.clip();
            for (let k = -1; k <= 1; k++) {
              const d = (((base + k) % 10) + 10) % 10;
              c.fillText(String(d), x + (digit - c.measureText(String(d)).width) / 2, baseline + (k - (position - base)) * size);
            }
            c.restore();
            x += digit;
            place--;
          }
        } else {
          x += [...finalText.slice(0, Math.max(0, pad))].reduce((s, ch) => s + glyphW(ch), 0);
          for (const ch of text) {
            const width = glyphW(ch);
            c.fillText(ch, x + (width - c.measureText(ch).width) / 2, baseline);
            x += width;
          }
        }
        for (const ch of suffix) {
          c.fillText(ch, x, baseline);
          x += glyphW(ch);
        }

        const reveal = clamp01(num(p, 'captionReveal'));
        if (p.caption && reveal > 0) {
          c.globalAlpha = reveal * clamp01(num(p, 'fade'));
          c.fillStyle = p.captionColor as string;
          c.font = `400 ${Math.max(18, size * 0.13)}px "${p.family}"`;
          c.textAlign = p.align as CanvasTextAlign;
          c.fillText(String(p.caption), px * w, baseline + size * 0.32 + (1 - reveal) * 12);
        }
        layer.end(ctx);
      },
      dispose() {
        layer.dispose();
      },
    };
  },
});
