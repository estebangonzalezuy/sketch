import type { Material } from './types'

const base: Material = {
  preset: 'Vidrio', color: '#ffffff', roughness: 0, metalness: 0, transmission: 1, ior: 1.5, dispersion: 0.5,
  iridescence: 0, film: 420, emission: 0, density: 0, scratches: 0,
}

export const MATERIALS: Record<string, Material> = {
  Vidrio: { ...base },
  'Vidrio tintado': { ...base, preset: 'Vidrio tintado', color: '#c9a2ff', density: 0.9, dispersion: 0.7, iridescence: 0.35, film: 380, scratches: 0.35 },
  'Vidrio esmerilado': { ...base, preset: 'Vidrio esmerilado', roughness: 0.32, dispersion: 0.15 },
  'Metal líquido': { ...base, preset: 'Metal líquido', color: '#e9e9ee', metalness: 1, roughness: 0.03, transmission: 0, dispersion: 0 },
  'Plástico mate': { ...base, preset: 'Plástico mate', color: '#d8d4cc', roughness: 0.62, transmission: 0, dispersion: 0, ior: 1.46 },
  Iridiscente: { ...base, preset: 'Iridiscente', color: '#f4f0ff', iridescence: 1, film: 460, dispersion: 0.8, density: 0.15 },
  'Cromo iridiscente': { ...base, preset: 'Cromo iridiscente', color: '#f0f0f0', metalness: 1, roughness: 0.06, transmission: 0, iridescence: 0.9, film: 520, dispersion: 0 },
  Emisivo: { ...base, preset: 'Emisivo', color: '#ffe9c4', transmission: 0, roughness: 0.5, emission: 6, dispersion: 0 },
}
export const MATERIAL_NAMES = Object.keys(MATERIALS)
export const mat = (name: string, over: Partial<Material> = {}): Material => ({ ...MATERIALS[name], ...over })
