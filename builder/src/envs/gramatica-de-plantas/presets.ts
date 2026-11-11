import type { PlantasParams as P } from "./params";

export const presets: { name: string; params: Partial<P> }[] = [
  { name: "esteban", params: {} },
  { name: "ana", params: { palabra: "ANA", gramática: { profundidad: 6, ángulo: 22, variación: 0.15, largo: 12 } } },
  { name: "x", params: { palabra: "X", gramática: { profundidad: 6, ángulo: 30, variación: 0.1, largo: 12 } } },
  { name: "barcelona por trazo", params: { palabra: "BARCELONA", gramática: { profundidad: 4, ángulo: 20, variación: 0.2, largo: 12 }, crecimiento: { segundos: 8, orden: "por trazo" } } },
  { name: "motion", params: { palabra: "MOTION", gramática: { profundidad: 5, ángulo: 35, variación: 0.05, largo: 12 }, trazo: { grosor: 2.5, afinar: true } } },
];
