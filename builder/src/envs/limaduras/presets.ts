import type { LimadurasParams as P } from "./params";

export const presets: { name: string; params: Partial<P> }[] = [
  { name: "imán", params: {} },
  { name: "dipolo único", params: { texto: "N S", imanes: { modo: "dipolo único", cantidad: 1, fuerza: 1, rotación: 0.3 }, tipo: { tamaño: 300, mostrarGlifo: true, ocultarDentro: true } } },
  { name: "libres", params: { texto: "CAMPO", imanes: { modo: "libres", cantidad: 5, fuerza: 1.4, rotación: 0.2 }, tipo: { tamaño: 260, mostrarGlifo: true, ocultarDentro: true } } },
  { name: "fino", params: { limaduras: { densidad: 1, largo: 8, grosor: 1.2, inercia: 0.9, jitter: 0.7 } } },
  { name: "débil", params: { imanes: { modo: "por letra", cantidad: 3, fuerza: 0.25, rotación: 0.15 } } },
];
