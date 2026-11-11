// Config DialKit copiado de envs/05-superilla/SPEC.md (sin cambios de nombres).
import type { DialConfig } from "dialkit";

export const params = {
  red: { manzanasX: [7, 3, 15, 1], manzanasY: [9, 3, 15, 1], celdasPorTramo: [12, 6, 30, 1], ochavas: true },
  tráfico: { densidad: [0.25, 0.02, 0.8], vMax: [5, 1, 8, 1], pFrenado: [0.15, 0, 0.6], entrada: [0.3, 0, 1], giro: [0.25, 0, 0.6] },
  cierre: { modo: { type: "select", options: ["click", "superilla 3×3", "ninguno"] } },
  vista: { modo: { type: "select", options: ["red", "espacio-tiempo"] }, tamañoCoche: [4, 2, 10] },
  pasosPorFrame: [1, 1, 4, 1],
  limpiarCierres: { type: "action" },
} satisfies DialConfig;

export interface SuperillaParams {
  red: { manzanasX: number; manzanasY: number; celdasPorTramo: number; ochavas: boolean };
  tráfico: { densidad: number; vMax: number; pFrenado: number; entrada: number; giro: number };
  cierre: { modo: "click" | "superilla 3×3" | "ninguno" };
  vista: { modo: "red" | "espacio-tiempo"; tamañoCoche: number };
  pasosPorFrame: number;
}
