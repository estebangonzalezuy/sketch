import type { MultiParams as P } from "./params";

export const presets: { name: string; params: Partial<P> }[] = [
  { name: "roma", params: {} },
  { name: "tejido", params: { vista: { modo: "trazas acumuladas", tamaño: 400 }, movimiento: { duración: 1.2, espera: 0.3, curva: 1 } } },
  { name: "ambas", params: { vista: { modo: "ambas", tamaño: 320 }, movimiento: { duración: 1.2, espera: 0.6, curva: 0.8 } } },
  { name: "saco caso cosa", params: { cadena: "SACO CASO COSA OCAS", vista: { modo: "ambas", tamaño: 220 } } },
  { name: "delira", params: { cadena: "DELIRA LIDERA", vista: { modo: "trazas acumuladas", tamaño: 160 }, movimiento: { duración: 1.4, espera: 0.4, curva: 0.5 } } },
];
