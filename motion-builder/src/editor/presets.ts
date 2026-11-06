import type { Params } from '../core/tool';

/** Presets del usuario: aparte de los de cada tool, en este navegador. */
const key = (toolId: string) => `motion-builder.presets.${toolId}`;

export function loadUserPresets(toolId: string): Record<string, Params> {
  try {
    return JSON.parse(localStorage.getItem(key(toolId)) ?? '{}');
  } catch {
    return {};
  }
}

export function saveUserPreset(toolId: string, name: string, values: Params) {
  const presets = { ...loadUserPresets(toolId), [name]: values };
  try {
    localStorage.setItem(key(toolId), JSON.stringify(presets));
  } catch (e) {
    console.warn('No se pudo guardar el preset', e);
  }
  return presets;
}
