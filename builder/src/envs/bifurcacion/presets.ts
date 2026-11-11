import type { BifurcacionParams as P } from "./params";

export const presets: { name: string; params: Partial<P> }[] = [
  { name: "cascada", params: {} },
  { name: "feigenbaum", params: { rango: { rMin: 3.4, rMax: 3.6, yMin: 0.3, yMax: 0.92 } } },
  { name: "ventana del 3", params: { rango: { rMin: 3.82, rMax: 3.87, yMin: 0, yMax: 1 }, barrido: { segundos: 10, iteraciones: 1200, descartar: 600 } } },
  { name: "caos", params: { rango: { rMin: 3.55, rMax: 4, yMin: 0, yMax: 1 }, barrido: { segundos: 10, iteraciones: 1500, descartar: 300 } } },
  { name: "lento", params: { barrido: { segundos: 20, iteraciones: 2000, descartar: 500 }, render: { dither: true, umbral: 0.55, punto: 8 } } },
];
