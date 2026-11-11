// Config DialKit copiado de envs/07-atractor/SPEC.md (sin cambios de nombres).
import type { DialConfig } from "dialkit";

export const params = {
  tipo: { type: "select", options: ["clifford", "de jong"] },
  a: [-1.4, -3, 3],
  b: [1.6, -3, 3],
  c: [1.0, -3, 3],
  d: [0.7, -3, 3],
  morph: { activo: true, amplitud: [0.3, 0, 1.5], segundos: [12, 2, 60] },
  densidad: { puntos: [2000000, 100000, 6000000, 100000], gamma: [0.6, 0.2, 2], umbral: [0.5, 0, 1] },
  render: { dither: { type: "select", options: ["bayer 4", "bayer 8", "floyd"] }, escala: [0.22, 0.05, 0.6] },
  mezclar: { type: "action" },
} satisfies DialConfig;

export interface AtractorParams {
  tipo: "clifford" | "de jong";
  a: number;
  b: number;
  c: number;
  d: number;
  morph: { activo: boolean; amplitud: number; segundos: number };
  densidad: { puntos: number; gamma: number; umbral: number };
  render: { dither: "bayer 4" | "bayer 8" | "floyd"; escala: number };
}
