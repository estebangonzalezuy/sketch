// Config DialKit copiado de envs/16-multi-anagrama/SPEC.md (sin cambios de nombres).
import type { DialConfig } from "dialkit";

export const params = {
  cadena: "ROMA AMOR MORA RAMO OMAR",
  movimiento: { duración: [1.2, 0.3, 4], espera: [0.6, 0, 3], curva: [0.4, 0, 1] },
  vista: { modo: { type: "select", options: ["palabra", "trazas acumuladas", "ambas"] }, tamaño: [200, 60, 500] },
} satisfies DialConfig;

export interface MultiParams {
  cadena: string;
  movimiento: { duración: number; espera: number; curva: number };
  vista: { modo: "palabra" | "trazas acumuladas" | "ambas"; tamaño: number };
}
