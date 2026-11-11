// Registro de entornos. Lazy import: la app no carga 17 cosas al arrancar.
// Los que todavía no existen aparecen desactivados en el switcher (sin placeholder visual).
import type { Env } from "../core/env";

export interface EnvEntry {
  num: string;
  id: string;
  title: string;
  load?: () => Promise<{ default: Env }>;
  /** slot externo (plugins/) */
  external?: boolean;
}

export const ENVS: EnvEntry[] = [
  { num: "01", id: "limaduras", title: "limaduras" },
  { num: "02", id: "viento-vivo", title: "viento vivo" },
  { num: "03", id: "orbita-saturada", title: "órbita saturada" },
  { num: "04", id: "huella-de-voz", title: "huella de voz" },
  { num: "05", id: "superilla", title: "superilla" },
  { num: "06", id: "bifurcacion", title: "bifurcación", load: () => import("./bifurcacion") },
  { num: "07", id: "atractor", title: "atractor", load: () => import("./atractor") },
  { num: "08", id: "polirritmo", title: "polirritmo" },
  { num: "09", id: "gramatica-de-plantas", title: "gramática de plantas" },
  { num: "10", id: "nervaduras", title: "nervaduras" },
  { num: "11", id: "metros-por-sueldo", title: "metros por sueldo" },
  { num: "12", id: "estratos", title: "estratos" },
  { num: "13", id: "feedback", title: "feedback", load: () => import("./feedback") },
  { num: "14", id: "markov-de-notas", title: "markov de notas" },
  { num: "15", id: "anagrama", title: "anagrama", load: () => import("./anagrama") },
  { num: "16", id: "multi-anagrama", title: "multi-anagrama", load: () => import("./multi-anagrama") },
  { num: "17", id: "live-tags", title: "live tags" },
  { num: "P1", id: "physarum-metro", title: "physarum metro", external: true },
  { num: "P2", id: "harmonografo", title: "harmonógrafo", external: true },
];

export const AVAILABLE = ENVS.filter((e) => e.load);

export function entryById(id: string | null | undefined): EnvEntry | undefined {
  return ENVS.find((e) => e.id === id && e.load);
}
