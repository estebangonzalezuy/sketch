// Config DialKit copiado de envs/13-feedback/SPEC.md (sin cambios de nombres).
import type { DialConfig } from "dialkit";

export const params = {
  semilla: { texto: "OK", tamaño: [0.5, 0.1, 1.2], cada: [1, 1, 30, 1] },
  transform: { zoom: [0.97, 0.8, 1.2], rotación: [2, -20, 20], desplazamientoX: [0, -0.05, 0.05], desplazamientoY: [0, -0.05, 0.05] },
  umbral: { valor: [0.5, 0, 1], invertir: true },
  resolución: { type: "select", options: ["1/1", "1/2", "1/4"] },
  limpiar: { type: "action" },
} satisfies DialConfig;

export interface FeedbackParams {
  semilla: { texto: string; tamaño: number; cada: number };
  transform: { zoom: number; rotación: number; desplazamientoX: number; desplazamientoY: number };
  umbral: { valor: number; invertir: boolean };
  resolución: "1/1" | "1/2" | "1/4";
}
