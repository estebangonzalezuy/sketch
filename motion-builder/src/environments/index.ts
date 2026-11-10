import { useSyncExternalStore } from 'react';
import type { ToolDefinition } from '../core/tool';

// Entornos: qué tools ofrece el editor para un proyecto. Hay dos de fábrica y los que arma cada uno
// eligiendo tools de cualquiera de ellos. Todas las tools siguen registradas en el motor: un entorno
// filtra lo que se puede agregar, no lo que se puede abrir.

export interface Environment {
  id: string;
  name: string;
  description: string;
  toolIds: string[];
  builtIn: boolean;
}

export const BUILT_IN: readonly Environment[] = [
  {
    id: 'inception',
    name: 'Inception',
    description: 'Las tools del editor original: texto, Tag Shader, extrusión, ASCII, datos y pixelado.',
    toolIds: ['text', 'tag-shader', 'text-extruder', 'ascii', 'chart', 'table', 'counter', 'pixelate'],
    builtIn: true,
  },
  {
    id: 'spray',
    name: 'Spray',
    description: 'Aerógrafo granulado que hierve, en las 2 tintas de un par tMSC: spray de fotos y los 7 modos del moodboard.',
    toolIds: ['spray', 'una-palabra', 'dato-grande', 'cruce', 'campo-partido', 'grano-papel', 'orbita', 'dither-field'],
    builtIn: true,
  },
];

export const DEFAULT_ENVIRONMENT = 'inception';
const KEY = 'mb:environments';

let custom: Environment[] = read();
let version = 0;
const listeners = new Set<() => void>();

function read(): Environment[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string' && Array.isArray(e.toolIds))
      .map((e) => ({ id: e.id, name: e.name, description: String(e.description ?? ''), toolIds: e.toolIds.map(String), builtIn: false }));
  } catch {
    return [];
  }
}

function write(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(custom));
  } catch {
    // sin almacenamiento: el entorno vive hasta recargar
  }
  version++;
  listeners.forEach((l) => l());
}

export const allEnvironments = (): Environment[] => [...BUILT_IN, ...custom];

export const environmentOf = (id: string | undefined | null): Environment | null => allEnvironments().find((e) => e.id === id) ?? null;

/** Tools que ofrece un entorno, en el orden del entorno. Sin entorno conocido, todas. */
export function toolsFor(env: Environment | null, tools: readonly ToolDefinition[]): readonly ToolDefinition[] {
  if (!env) return tools;
  return env.toolIds.map((id) => tools.find((t) => t.id === id)).filter((t): t is ToolDefinition => !!t);
}

function slug(name: string): string {
  const base =
    'propio-' +
    (name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'entorno');
  let id = base;
  for (let i = 2; allEnvironments().some((e) => e.id === id); i++) id = `${base}-${i}`;
  return id;
}

/** Crea o actualiza un entorno propio. Devuelve su id. */
export function saveEnvironment(input: { id?: string; name: string; description?: string; toolIds: string[] }): string {
  const name = input.name.trim() || 'Entorno sin nombre';
  const existing = input.id ? custom.find((e) => e.id === input.id) : undefined;
  const env: Environment = { id: existing?.id ?? slug(name), name, description: input.description?.trim() ?? '', toolIds: [...new Set(input.toolIds)], builtIn: false };
  custom = existing ? custom.map((e) => (e.id === env.id ? env : e)) : [...custom, env];
  write();
  return env.id;
}

export function deleteEnvironment(id: string): void {
  custom = custom.filter((e) => e.id !== id);
  write();
}

/** Re-render cuando cambia la lista de entornos propios. */
export function useEnvironments(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
}
