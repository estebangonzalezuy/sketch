import type { AtractorParams as P } from "./params";

export const presets: { name: string; params: Partial<P> }[] = [
  { name: "humo", params: { tipo: "clifford", a: -1.4, b: 1.6, c: 1.0, d: 0.7 } },
  { name: "lazo ancho", params: { tipo: "clifford", a: 1.7, b: 1.7, c: 0.6, d: 1.2, morph: { activo: true, amplitud: 0.2, segundos: 16 } } },
  { name: "cinta", params: { tipo: "clifford", a: -1.7, b: 1.8, c: -1.9, d: -0.4, render: { dither: "bayer 8", escala: 0.2 } } },
  { name: "de jong seda", params: { tipo: "de jong", a: 1.4, b: -2.3, c: 2.4, d: -2.1, morph: { activo: true, amplitud: 0.15, segundos: 20 } } },
  { name: "de jong grano", params: { tipo: "de jong", a: -2.7, b: -0.09, c: -0.86, d: -2.2, render: { dither: "floyd", escala: 0.2 } } },
];
