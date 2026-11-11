// Config DialKit copiado de envs/08-polirritmo/SPEC.md (sin cambios de nombres).
import type { DialConfig } from "dialkit";

export const params = {
  ratios: "3:4:5:7",
  ciclo: { segundos: [12, 2, 60], realineaciones: [1, 1, 8, 1] },
  forma: { radioMin: [0.12, 0.05, 0.5], separación: [0.07, 0.02, 0.15], punto: [14, 4, 40], ejeAngulo: [0, 0, 360] },
  sonido: { activo: true, escala: { type: "select", options: ["mayor", "menor", "pentatónica"] }, raíz: [60, 36, 84, 1], volumen: [0.6, 0, 1] },
  salida: { midi: false, motionInstrument: false, broadcast: false },
} satisfies DialConfig;

export interface PolirritmoParams {
  ratios: string;
  ciclo: { segundos: number; realineaciones: number };
  forma: { radioMin: number; separación: number; punto: number; ejeAngulo: number };
  sonido: { activo: boolean; escala: "mayor" | "menor" | "pentatónica"; raíz: number; volumen: number };
  salida: { midi: boolean; motionInstrument: boolean; broadcast: boolean };
}
