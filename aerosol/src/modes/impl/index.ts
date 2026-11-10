import type { ModeFrame } from '../../gl/renderer';
import type { DialValues } from '../types';
import { unaPalabra } from './una-palabra';
import { datoGrande } from './dato-grande';
import { cruce } from './cruce';
import { campoPartido } from './campo-partido';
import { granoPapel } from './grano-papel';

/** Canvases donde dibuja un modo, a la resolución de export. */
export interface ModeLayers {
  /** Densidad de la figura: blanco = tinta de figura, gris = densidad parcial (el dato). */
  fig: CanvasRenderingContext2D;
  /** Capa nítida (type chico, trazos de 1 px): no pasa por el airbrush. */
  crisp: CanvasRenderingContext2D;
  w: number;
  h: number;
}

export interface ModeImpl {
  /** Largo del loop en segundos (intro + Hold). */
  duration(v: DialValues): number;
  /** Cambia solo cuando hay que volver a dibujar las capas (si no, no se re-suben). */
  key(t: number, v: DialValues): string;
  draw(l: ModeLayers, t: number, v: DialValues): void;
  frame(t: number, v: DialValues): ModeFrame;
}

export const IMPLS: Record<string, ModeImpl> = {
  'una-palabra': unaPalabra,
  'dato-grande': datoGrande,
  cruce,
  'campo-partido': campoPartido,
  'grano-papel': granoPapel,
};
