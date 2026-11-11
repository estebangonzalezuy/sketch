// Config DialKit copiado de envs/10-nervaduras/SPEC.md (sin cambios de nombres).
import type { DialConfig } from "dialkit";

export const params = {
  letra: "A",
  colonización: { auxinas: [3000, 300, 8000, 100], radioInfluencia: [40, 10, 120], radioMuerte: [6, 2, 20], paso: [4, 1, 10] },
  frente: { velocidad: [1, 0.1, 4] },
  trazo: { grosorBase: [6, 1, 20], exponente: [2.5, 2, 3.5], mostrarContorno: true },
  reiniciar: { type: "action" },
} satisfies DialConfig;

export interface NervadurasParams {
  letra: string;
  colonización: { auxinas: number; radioInfluencia: number; radioMuerte: number; paso: number };
  frente: { velocidad: number };
  trazo: { grosorBase: number; exponente: number; mostrarContorno: boolean };
}
