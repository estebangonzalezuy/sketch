// Plantas 3D: mismos nombres que Gramática de Plantas donde aplica, más filotaxis, sombreado y cámara.
import type { DialConfig } from "dialkit";

export const params = {
  palabra: "ESTEBAN",
  gramática: { profundidad: [5, 1, 8, 1], ángulo: [25, 5, 60], variación: [0.1, 0, 0.5], filotaxis: [137.5, 0, 180, 0.5] },
  crecimiento: { segundos: [6, 1, 20], orden: { type: "select", options: ["por generación", "por trazo"] } },
  trazo: { grosor: [14, 2, 40, 0.5], afinar: true, sombreado: { type: "select", options: ["dither", "plano"] } },
  cámara: { vueltas: [1, 0, 3, 1], elevación: [12, -20, 70], distancia: [1, 0.6, 2] },
  mostrarRegla: true,
} satisfies DialConfig;

export interface Plantas3dParams {
  palabra: string;
  gramática: { profundidad: number; ángulo: number; variación: number; filotaxis: number };
  crecimiento: { segundos: number; orden: "por generación" | "por trazo" };
  trazo: { grosor: number; afinar: boolean; sombreado: "dither" | "plano" };
  cámara: { vueltas: number; elevación: number; distancia: number };
  mostrarRegla: boolean;
}
