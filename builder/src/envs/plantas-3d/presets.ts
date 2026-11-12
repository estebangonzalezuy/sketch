import type { Plantas3dParams as P } from "./params";

export const presets: { name: string; params: Partial<P> }[] = [
  { name: "esteban", params: {} },
  { name: "ana desde arriba", params: { palabra: "ANA", gramática: { profundidad: 6, ángulo: 24, variación: 0.15, filotaxis: 137.5 }, cámara: { vueltas: 1, elevación: 55, distancia: 1 } } },
  { name: "x plana (filotaxis 0)", params: { palabra: "X", gramática: { profundidad: 6, ángulo: 30, variación: 0.1, filotaxis: 0 } } },
  { name: "motion plano", params: { palabra: "MOTION", gramática: { profundidad: 5, ángulo: 35, variación: 0.05, filotaxis: 137.5 }, trazo: { grosor: 16, afinar: true, sombreado: "plano" } } },
  { name: "barcelona por trazo", params: { palabra: "BARCELONA", gramática: { profundidad: 4, ángulo: 22, variación: 0.2, filotaxis: 90 }, crecimiento: { segundos: 8, orden: "por trazo" }, cámara: { vueltas: 2, elevación: 20, distancia: 1 } } },
];
