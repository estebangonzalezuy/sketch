import type { NervadurasParams as P } from "./params";

export const presets: { name: string; params: Partial<P> }[] = [
  { name: "a", params: {} },
  { name: "r densa", params: { letra: "R", colonización: { auxinas: 6000, radioInfluencia: 30, radioMuerte: 5, paso: 3 } } },
  { name: "s lenta", params: { letra: "S", frente: { velocidad: 0.6 }, trazo: { grosorBase: 8, exponente: 2.5, mostrarContorno: true } } },
  { name: "e sin contorno", params: { letra: "E", trazo: { grosorBase: 10, exponente: 3, mostrarContorno: false } } },
  { name: "g abierta", params: { letra: "g", colonización: { auxinas: 2000, radioInfluencia: 70, radioMuerte: 10, paso: 6 } } },
];
