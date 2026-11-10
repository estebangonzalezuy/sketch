import * as THREE from 'three';
import { defineTool, type AnimationTemplate, type InputSpec, type ParamSpecs, type Params, type RenderContext, type ToolDefinition } from '../../core/tool';
import { readColour, readPaint, sprayParams, type PaintDefaults } from './params';
import { SprayPipeline, type ModeFrame } from './pipeline';
import { SmearField } from './smear';

// Fábrica de las tools de modo del entorno Spray. Cada modo dibuja su figura en dos canvas 2D
// (densidad y capa nítida) y el pipeline compartido hace el resto: airbrush, grano, estilo y par.

export interface ModeLayers {
  fig: CanvasRenderingContext2D;
  crisp: CanvasRenderingContext2D;
  w: number;
  h: number;
}

export interface ModeSpec {
  id: string;
  name: string;
  params: ParamSpecs;
  paint: PaintDefaults;
  animations: Record<string, AnimationTemplate>;
  presets?: Record<string, Params>;
  inputs?: InputSpec[];
  /** Cambia solo cuando hay que redibujar las capas. */
  key(p: Params): string;
  draw(l: ModeLayers, p: Params): void;
  frame(p: Params, ctx: RenderContext): ModeFrame;
}

export const FONT = 'Archivo Narrow';

function layer() {
  const canvas = document.createElement('canvas');
  const c = canvas.getContext('2d', { willReadFrequently: true })!; // raster por CPU: estable entre corridas
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return { canvas, c, texture };
}

export function modeTool(spec: ModeSpec): ToolDefinition {
  const shared = sprayParams(spec.paint);
  const clash = Object.keys(spec.params).filter((k) => k in shared);
  if (clash.length) throw new Error(`${spec.id}: parámetros que pisan los de Pintura/Color/Touch: ${clash.join(', ')}`);
  return defineTool({
    id: spec.id,
    name: spec.name,
    version: 1,
    kind: spec.inputs?.length ? 'hybrid' : 'generator',
    inputs: spec.inputs ?? [],
    params: { ...spec.params, ...shared },
    presets: spec.presets,
    animations: spec.animations,
    create() {
      const pipeline = new SprayPipeline();
      const smear = new SmearField();
      const fig = layer();
      const crisp = layer();
      let drawn = '';
      return {
        async prepare() {
          await Promise.all([document.fonts.load(`700 100px "${FONT}"`), document.fonts.load(`500 100px "${FONT}"`)]);
        },
        render(p: Params, ctx: RenderContext) {
          const w = ctx.width;
          const h = ctx.height;
          for (const l of [fig, crisp]) {
            if (l.canvas.width !== w || l.canvas.height !== h) {
              l.canvas.width = w;
              l.canvas.height = h;
              l.texture.dispose(); // el tamaño en la GPU es fijo: se recrea
              drawn = '';
            }
          }
          const key = `${w}x${h}|${spec.key(p)}`;
          if (key !== drawn) {
            for (const l of [fig, crisp]) {
              l.c.reset();
              l.c.fillStyle = '#000';
              l.c.fillRect(0, 0, w, h);
            }
            spec.draw({ fig: fig.c, crisp: crisp.c, w, h }, p);
            fig.texture.needsUpdate = true;
            crisp.texture.needsUpdate = true;
            drawn = key;
          }
          const hasField = smear.advance(ctx.renderer, pipeline.quadRef, p.strokes as string, ctx.frame, ctx.fps, p.brush as number, p.spring as number, w, h);
          pipeline.renderMode(ctx, {
            fig: fig.texture,
            crisp: crisp.texture,
            photo: ctx.inputs.photo ?? null,
            frame: spec.frame(p, ctx),
            field: hasField ? smear.texture : null,
            paint: readPaint(p),
            colour: readColour(p),
          });
          ctx.renderer.setRenderTarget(ctx.target);
        },
        dispose() {
          pipeline.dispose();
          smear.dispose();
          fig.texture.dispose();
          crisp.texture.dispose();
        },
      };
    },
  });
}

// --- Ayudas de dibujo (las mismas de la app original).

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOutBack = (x: number, k = 1.4) => {
  const t = clamp01(x) - 1;
  return 1 + (k + 1) * t * t * t + k * t * t;
};

export function font(weight: number, px: number): string {
  return `${Math.round(weight)} ${px}px "${FONT}", "Arial Narrow", Arial, sans-serif`;
}

/** Tamaño de fuente para que `text` ocupe `width` px. */
export function fitFont(c: CanvasRenderingContext2D, text: string, weight: number, width: number): number {
  c.font = font(weight, 100);
  return (100 * width) / Math.max(1, c.measureText(text || ' ').width);
}

/** Una línea centrada ópticamente (por su caja de tinta) en (x, y). */
export function drawCentered(c: CanvasRenderingContext2D, text: string, weight: number, px: number, x: number, y: number): void {
  c.font = font(weight, px);
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  const m = c.measureText(text);
  const dx = (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2;
  c.fillText(text, x + dx, y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
}
