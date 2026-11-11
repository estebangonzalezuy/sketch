// Config DialKit copiado de envs/06-bifurcacion/SPEC.md (sin cambios de nombres).
import type { DialConfig } from "dialkit";

export const params = {
  rango: { rMin: [2.8, 0, 4], rMax: [4, 0, 4], yMin: [0, 0, 1], yMax: [1, 0, 1] },
  barrido: { segundos: [8, 2, 30], iteraciones: [400, 50, 3000, 10], descartar: [300, 0, 2000, 10] },
  render: { dither: true, umbral: [0.5, 0, 1], punto: [6, 2, 20] },
  rótulos: true,
} satisfies DialConfig;

export interface BifurcacionParams {
  rango: { rMin: number; rMax: number; yMin: number; yMax: number };
  barrido: { segundos: number; iteraciones: number; descartar: number };
  render: { dither: boolean; umbral: number; punto: number };
  rótulos: boolean;
}
