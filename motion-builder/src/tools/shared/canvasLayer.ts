import * as THREE from 'three';
import type { RenderContext } from '../../core/tool';

/** Canvas 2D subido como textura, para tools que dibujan en unidades de diseño: lado corto de 1080. */
export function createCanvasLayer() {
  const canvas = document.createElement('canvas');
  const c = canvas.getContext('2d', { willReadFrequently: true })!; // raster por CPU: por GPU varía entre corridas
  const texture = new THREE.CanvasTexture(canvas);
  texture.premultiplyAlpha = true;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;

  return {
    c,
    /** Limpia y deja el contexto en unidades de diseño. Devuelve el tamaño del cuadro en esas unidades. */
    begin(ctx: RenderContext) {
      if (canvas.width !== ctx.width || canvas.height !== ctx.height) {
        canvas.width = ctx.width;
        canvas.height = ctx.height;
        texture.dispose(); // el tamaño de una textura en la GPU es fijo: hay que recrearla
      }
      c.reset(); // nada del estado del frame anterior: ni transformación, ni estilos de línea
      c.scale(ctx.unit, ctx.unit);
      return { w: ctx.width / ctx.unit, h: ctx.height / ctx.unit };
    },
    end(ctx: RenderContext) {
      texture.needsUpdate = true;
      ctx.blit(texture);
    },
    dispose() {
      texture.dispose();
    },
  };
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Avance de un elemento que arranca en `start` de un progreso general y dura `span`. */
export const stepIn = (progress: number, start: number, span: number) => {
  const t = clamp01((progress - start) / Math.max(span, 1e-6));
  return 1 - (1 - t) ** 3;
};

export const fontsReady = (fonts: string[]) => Promise.all(fonts.map((f) => document.fonts.load(f)));
