import { GROUPS, type Dial, type DialValues, type ModeDef } from './types';

const files = import.meta.glob<{ default: ModeDef }>('./*.json', { eager: true });

function validate(m: ModeDef, file: string): ModeDef {
  const fail = (msg: string) => {
    throw new Error(`Modo inválido en ${file}: ${msg}`);
  };
  if (!m.id || !m.label) fail('falta id o label');
  if (!GROUPS.includes(m.group)) fail(`grupo desconocido "${m.group}"`);
  if (m.status !== 'aprobada' && m.status !== 'propuesta') fail(`status "${m.status}"`);
  if (!Array.isArray(m.dials)) fail('dials no es un array');
  if (!Array.isArray(m.optionalUnlocked)) fail('optionalUnlocked no es un array');
  const ids = new Set<string>();
  for (const d of m.dials) {
    if (ids.has(d.id)) fail(`dial repetido "${d.id}"`);
    ids.add(d.id);
  }
  return m;
}

export const MODES: ModeDef[] = Object.entries(files)
  .map(([file, mod]) => validate(mod.default, file))
  .sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));

export const BASE_MODE = 'photo-spray';

export function getMode(id: string): ModeDef {
  return MODES.find((m) => m.id === id) ?? MODES.find((m) => m.id === BASE_MODE)!;
}

export function modesIn(group: (typeof GROUPS)[number]): ModeDef[] {
  return MODES.filter((m) => m.group === group);
}

export function dialDefaults(dials: Dial[]): DialValues {
  return Object.fromEntries(dials.map((d) => [d.id, d.default]));
}
