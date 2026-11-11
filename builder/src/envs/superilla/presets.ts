import type { SuperillaParams as P } from "./params";

export const presets: { name: string; params: Partial<P> }[] = [
  { name: "eixample", params: {} },
  { name: "superilla 3×3", params: { cierre: { modo: "superilla 3×3" } } },
  { name: "hora punta", params: { tráfico: { densidad: 0.45, vMax: 5, pFrenado: 0.2, entrada: 0.6, giro: 0.25 }, pasosPorFrame: 2 } },
  { name: "espacio-tiempo", params: { vista: { modo: "espacio-tiempo", tamañoCoche: 4 }, tráfico: { densidad: 0.35, vMax: 5, pFrenado: 0.25, entrada: 0.4, giro: 0.15 } } },
  { name: "superilla en hora punta", params: { cierre: { modo: "superilla 3×3" }, tráfico: { densidad: 0.45, vMax: 5, pFrenado: 0.2, entrada: 0.6, giro: 0.25 }, pasosPorFrame: 2 } },
];
