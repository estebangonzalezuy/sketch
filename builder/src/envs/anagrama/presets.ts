import type { AnagramaParams as P } from "./params";

export const presets: { name: string; params: Partial<P> }[] = [
  { name: "amor roma", params: {} },
  { name: "delira lidera", params: { desde: "DELIRA", hasta: "LIDERA", tipo: { tamaño: 170, tracking: 0.15 } } },
  { name: "alergia galería", params: { desde: "ALERGIA", hasta: "GALERIA", tipo: { tamaño: 140, tracking: 0.12 } } },
  { name: "listen silent", params: { desde: "LISTEN", hasta: "SILENT", tipo: { tamaño: 170, tracking: 0.2 } } },
  { name: "ramo mora lento", params: { desde: "RAMO", hasta: "MORA", movimiento: { duración: 3, espera: 1.2, stagger: 0.2, curva: 0.8, easing: { type: "easing", duration: 3, ease: [0.65, 0, 0.35, 1] } } } },
];
