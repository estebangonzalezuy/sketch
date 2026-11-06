import * as THREE from 'three';
import { defineTool, type Params, type RenderContext } from '../../core/tool';
import { hash01 } from '../../core/random';
import animations from './animations';
import presets from './presets.json';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default defineTool({
  id: 'text',
  name: 'Texto',
  version: 1,
  kind: 'generator',
  presets,
  animations,
  inputs: [],
  params: {
    text: { kind: 'text', default: 'MOTION', multiline: true, animate: 'none', group: 'Contenido' },
    family: { kind: 'select', default: 'KMR Apparat', options: ['KMR Apparat', 'Archivo Narrow', 'Geist Mono'], animate: 'none', group: 'Tipo' },
    weight: { kind: 'number', default: 700, min: 100, max: 900, step: 100, animate: 'none', group: 'Tipo' },
    size: { kind: 'number', default: 160, min: 8, max: 800, animate: 'frame', group: 'Tipo' },
    tracking: { kind: 'number', default: 0, min: -0.2, max: 1, step: 0.005, animate: 'frame', group: 'Tipo' },
    lineHeight: { kind: 'number', default: 1, min: 0.6, max: 2, step: 0.01, animate: 'frame', group: 'Tipo' },
    align: { kind: 'select', default: 'left', options: ['left', 'center', 'right'], animate: 'none', group: 'Tipo' },
    color: { kind: 'color', default: '#FFFFFF', animate: 'frame', group: 'Tipo' },
    position: { kind: 'vec2', default: [0.5, 0.5], min: 0, max: 1, animate: 'frame', group: 'Layout' },
    unitBy: { kind: 'select', default: 'chars', options: ['chars', 'words', 'lines'], animate: 'none', group: 'Revelado' },
    order: { kind: 'select', default: 'forward', options: ['forward', 'random'], animate: 'none', group: 'Revelado' },
    reveal: { kind: 'number', default: 1, min: 0, max: 1, step: 0.001, animate: 'frame', group: 'Revelado' },
    stagger: { kind: 'number', default: 0.6, min: 0, max: 0.95, step: 0.01, animate: 'frame', group: 'Revelado' },
    rise: { kind: 'number', default: 40, min: -400, max: 400, animate: 'frame', group: 'Revelado' },
  },
  create() {
    const canvas = document.createElement('canvas');
    const c = canvas.getContext('2d', { willReadFrequently: true })!; // raster por CPU: por GPU varía entre corridas
    const texture = new THREE.CanvasTexture(canvas);
    texture.premultiplyAlpha = true;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;

    return {
      async prepare(p: Params) {
        await document.fonts.load(`${p.weight} 100px "${p.family}"`);
      },
      render(p: Params, ctx: RenderContext) {
        if (canvas.width !== ctx.width || canvas.height !== ctx.height) {
          canvas.width = ctx.width;
          canvas.height = ctx.height;
          texture.dispose(); // el tamaño de una textura en la GPU es fijo: hay que recrearla
        }
        c.clearRect(0, 0, ctx.width, ctx.height);
        const size = (p.size as number) * ctx.unit;
        c.font = `${p.weight} ${size}px "${p.family}"`;
        c.letterSpacing = `${(p.tracking as number) * size}px`;
        c.fillStyle = p.color as string;
        c.textBaseline = 'alphabetic';

        const lines = String(p.text).split('\n');
        const leading = size * (p.lineHeight as number);
        const [px, py] = p.position as [number, number];
        const x0 = px * ctx.width;
        const y0 = py * ctx.height - ((lines.length - 1) * leading) / 2 + size * 0.35;

        // Cada carácter recuerda a qué unidad pertenece.
        type Glyph = { char: string; x: number; y: number; unit: number };
        const glyphs: Glyph[] = [];
        let unit = 0;
        lines.forEach((line, row) => {
          const width = c.measureText(line).width;
          const start = p.align === 'center' ? x0 - width / 2 : p.align === 'right' ? x0 - width : x0;
          for (let i = 0; i < line.length; i++) {
            if (p.unitBy === 'words' && line[i] === ' ') unit++;
            if (line[i] === ' ') continue;
            // Medir el prefijo conserva el kerning.
            glyphs.push({ char: line[i], x: start + c.measureText(line.slice(0, i)).width, y: y0 + row * leading, unit });
            if (p.unitBy === 'chars') unit++;
          }
          if (p.unitBy !== 'chars') unit++;
        });

        const stagger = p.stagger as number;
        const reveal = p.reveal as number;
        const rank = (i: number) => (p.order === 'random' ? hash01(ctx.seed, i) : i / Math.max(1, unit - 1));
        for (const g of glyphs) {
          const start = rank(g.unit) * stagger;
          const amount = clamp01((reveal - start) / (1 - stagger));
          if (amount <= 0) continue;
          c.globalAlpha = amount;
          c.fillText(g.char, g.x, g.y + (1 - amount) * (p.rise as number) * ctx.unit);
        }
        c.globalAlpha = 1;
        texture.needsUpdate = true;
        ctx.blit(texture);
      },
      dispose() {
        texture.dispose();
      },
    };
  },
});
