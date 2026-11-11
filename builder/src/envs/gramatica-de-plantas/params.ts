// Config DialKit copiado de envs/09-gramatica-de-plantas/SPEC.md (sin cambios de nombres).
import type { DialConfig } from "dialkit";

export const params = {
  palabra: "ESTEBAN",
  gramática: { profundidad: [5, 1, 8, 1], ángulo: [25, 5, 60], variación: [0.1, 0, 0.5], largo: [12, 2, 40] },
  crecimiento: { segundos: [6, 1, 20], orden: { type: "select", options: ["por generación", "por trazo"] } },
  trazo: { grosor: [1.5, 0.5, 6, 0.1], afinar: true },
  mostrarRegla: true,
} satisfies DialConfig;

export interface PlantasParams {
  palabra: string;
  gramática: { profundidad: number; ángulo: number; variación: number; largo: number };
  crecimiento: { segundos: number; orden: "por generación" | "por trazo" };
  trazo: { grosor: number; afinar: boolean };
  mostrarRegla: boolean;
}
