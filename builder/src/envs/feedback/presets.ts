import type { FeedbackParams as P } from "./params";

export const presets: { name: string; params: Partial<P> }[] = [
  { name: "ok túnel", params: {} },
  { name: "espiral", params: { transform: { zoom: 0.95, rotación: 7, desplazamientoX: 0, desplazamientoY: 0 } } },
  { name: "expansión", params: { transform: { zoom: 1.035, rotación: 3, desplazamientoX: 0, desplazamientoY: 0 }, semilla: { texto: "OK", tamaño: 0.3, cada: 1 } } },
  { name: "grano 1/4", params: { resolución: "1/4", transform: { zoom: 0.93, rotación: -4, desplazamientoX: 0, desplazamientoY: 0 } } },
  { name: "deriva", params: { transform: { zoom: 0.96, rotación: 1.5, desplazamientoX: 0.012, desplazamientoY: -0.008 }, umbral: { valor: 0.45, invertir: false } } },
];
