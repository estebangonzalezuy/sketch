// Config DialKit copiado de envs/01-limaduras/SPEC.md (sin cambios de nombres).
import type { DialConfig } from "dialkit";

export const params = {
  texto: "IMAN",
  imanes: { modo: { type: "select", options: ["por letra", "libres", "dipolo único"] }, cantidad: [3, 1, 12, 1], fuerza: [1, 0.1, 3], rotación: [0.15, 0, 2] },
  limaduras: { densidad: [0.6, 0.1, 1], largo: [14, 4, 40], grosor: [1.6, 1, 4, 0.1], inercia: [0.85, 0, 0.99], jitter: [0.5, 0, 1] },
  tipo: { tamaño: [380, 80, 900], mostrarGlifo: true, ocultarDentro: true },
  reiniciar: { type: "action" },
} satisfies DialConfig;

export interface LimadurasParams {
  texto: string;
  imanes: { modo: "por letra" | "libres" | "dipolo único"; cantidad: number; fuerza: number; rotación: number };
  limaduras: { densidad: number; largo: number; grosor: number; inercia: number; jitter: number };
  tipo: { tamaño: number; mostrarGlifo: boolean; ocultarDentro: boolean };
}
