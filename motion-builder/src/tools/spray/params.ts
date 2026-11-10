import type { ParamSpecs, Params } from '../../core/tool';
import { PAIR_OPTIONS } from './palette';
import { STYLES, type Colour, type Paint } from './pipeline';

// Parámetros que comparten todas las tools del entorno Spray: Pintura, Efectos, Color y Touch.

export interface PaintDefaults extends Partial<Paint> {
  pair?: string;
}

export function sprayParams(d: PaintDefaults = {}): ParamSpecs {
  return {
    style: { kind: 'select', default: d.style ?? 'spray', options: STYLES, label: 'estilo', animate: 'frame', group: 'Pintura' },
    airbrush: { kind: 'number', default: d.airbrush ?? 4, min: 0, max: 12, step: 0.05, animate: 'frame', group: 'Pintura' },
    grain: { kind: 'number', default: d.grain ?? 22, min: 0, max: 50, step: 1, label: 'grano', animate: 'frame', group: 'Pintura' },
    boil: { kind: 'number', default: d.boil ?? 1, min: 0, max: 3, step: 0.01, label: 'hervor', animate: 'frame', group: 'Pintura' },
    flatten: { kind: 'number', default: d.flatten ?? 7, min: 2, max: 12, step: 1, label: 'niveles', animate: 'frame', group: 'Pintura' },
    saturation: { kind: 'number', default: d.saturation ?? 1.45, min: 0, max: 2.5, step: 0.01, label: 'saturación', animate: 'frame', group: 'Pintura' },
    pale: { kind: 'number', default: d.pale ?? 0.3, min: 0, max: 1, step: 0.01, label: 'pale ground', animate: 'frame', group: 'Pintura' },
    matrix: { kind: 'select', default: d.matrix ?? 'blue noise', options: ['bayer', 'blue noise'], label: 'matriz (stipple)', animate: 'frame', group: 'Pintura' },
    cell: { kind: 'number', default: d.cell ?? 2, min: 1, max: 12, step: 1, label: 'celda (stipple)', animate: 'frame', group: 'Pintura' },
    wave: { kind: 'number', default: d.wave ?? 0, min: 0, max: 1, step: 0.01, label: 'onda', animate: 'frame', group: 'Efectos' },
    glass: { kind: 'number', default: d.glass ?? 0, min: 0, max: 1, step: 0.01, label: 'vidrio', animate: 'frame', group: 'Efectos' },
    chroma: { kind: 'number', default: d.chroma ?? 0, min: 0, max: 1, step: 0.01, label: 'croma', animate: 'frame', group: 'Efectos' },
    glow: { kind: 'number', default: d.glow ?? 0, min: 0, max: 1, step: 0.01, label: 'brillo', animate: 'frame', group: 'Efectos' },
    pair: { kind: 'select', default: d.pair ?? 'ink/white', options: PAIR_OPTIONS, label: 'par', animate: 'frame', group: 'Color' },
    invert: { kind: 'boolean', default: false, label: 'invertir', animate: 'frame', group: 'Color' },
    full: { kind: 'boolean', default: false, label: 'paleta completa · fuera de pares', animate: 'frame', group: 'Color' },
    brandMix: { kind: 'number', default: d.brandMix ?? 0.7, min: 0, max: 1, step: 0.01, label: 'brand mix (paleta completa)', animate: 'frame', group: 'Color' },
    brush: { kind: 'number', default: 0.12, min: 0.02, max: 0.4, step: 0.01, label: 'pincel', animate: 'none', group: 'Touch' },
    spring: { kind: 'number', default: 0.2, min: 0, max: 1, step: 0.01, label: 'vuelve', animate: 'none', group: 'Touch' },
    strokes: { kind: 'text', default: '', label: 'trazos', animate: 'none', group: 'Touch', hidden: true },
  };
}

export const readPaint = (p: Params): Paint => ({
  style: p.style as string,
  airbrush: p.airbrush as number,
  grain: p.grain as number,
  boil: p.boil as number,
  flatten: p.flatten as number,
  saturation: p.saturation as number,
  pale: p.pale as number,
  wave: p.wave as number,
  glass: p.glass as number,
  chroma: p.chroma as number,
  glow: p.glow as number,
  matrix: p.matrix as string,
  cell: p.cell as number,
  brandMix: p.brandMix as number,
});

export const readColour = (p: Params): Colour => ({ pair: p.pair as string, invert: p.invert as boolean, full: p.full as boolean });
