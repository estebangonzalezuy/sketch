import type { PolirritmoParams as P } from "./params";

export const presets: { name: string; params: Partial<P> }[] = [
  { name: "3:4:5:7", params: {} },
  { name: "2:3", params: { ratios: "2:3", ciclo: { segundos: 6, realineaciones: 1 }, forma: { radioMin: 0.2, separación: 0.12, punto: 24, ejeAngulo: 0 } } },
  { name: "escalera 1–8", params: { ratios: "1:2:3:4:5:6:7:8", ciclo: { segundos: 16, realineaciones: 1 }, forma: { radioMin: 0.08, separación: 0.045, punto: 12, ejeAngulo: 0 } } },
  { name: "primos", params: { ratios: "2:3:5:7:11", ciclo: { segundos: 20, realineaciones: 1 }, sonido: { activo: true, escala: "pentatónica", raíz: 57, volumen: 0.6 } } },
  { name: "eje horizontal", params: { ratios: "4:5:6", ciclo: { segundos: 10, realineaciones: 2 }, forma: { radioMin: 0.16, separación: 0.09, punto: 18, ejeAngulo: 90 } } },
];
