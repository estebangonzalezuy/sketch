// Config DialKit copiado de envs/15-anagrama/SPEC.md (sin cambios de nombres).
import type { DialConfig } from "dialkit";

export const params = {
  desde: "AMOR",
  hasta: "ROMA",
  movimiento: {
    duración: [1.6, 0.3, 5],
    espera: [0.8, 0, 4],
    stagger: [0.06, 0, 0.4],
    curva: [0.4, 0, 1],
    easing: { type: "easing", duration: 1.6, ease: [0.65, 0, 0.35, 1] },
  },
  tipo: { tamaño: [220, 60, 600], tracking: [0.2, -0.1, 1] },
  trazas: true,
} satisfies DialConfig;

export interface AnagramaParams {
  desde: string;
  hasta: string;
  movimiento: { duración: number; espera: number; stagger: number; curva: number; easing: unknown };
  tipo: { tamaño: number; tracking: number };
  trazas: boolean;
}
