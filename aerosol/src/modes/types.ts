// Forma de un modo. Cada modo es un JSON en esta carpeta; los modos que dibujan su propia figura
// suman una implementación en `impl/` con el mismo id.

export const GROUPS = ['Base', 'Figma Q3', 'Moodboard'] as const;
export type Group = (typeof GROUPS)[number];
export type Status = 'aprobada' | 'propuesta';

interface DialBase {
  id: string;
  label: string;
  /** Reusa un parámetro existente de la tool (p. ej. "grain" de Paint) en vez de uno propio. */
  bind?: string;
}
export interface RangeDial extends DialBase {
  type: 'range';
  min: number;
  max: number;
  step: number;
  default: number;
  digits?: number;
  suffix?: string;
}
export interface ChoiceDial extends DialBase {
  type: 'choice';
  options: string[];
  default: string;
}
export interface TextDial extends DialBase {
  type: 'text';
  default: string;
  multiline?: boolean;
}
export interface ToggleDial extends DialBase {
  type: 'toggle';
  default: boolean;
}
export type Dial = RangeDial | ChoiceDial | TextDial | ToggleDial;
export type DialValue = number | string | boolean;
export type DialValues = Record<string, DialValue>;

/** Opción fuera de pares locked: off por default y marcada en la UI. */
export interface UnlockedFlag {
  id: string;
  label: string;
  /** Reemplaza el par activo mientras está prendida (campo, figura). */
  pair?: { field: string; figure: string };
}

export interface ModeDef {
  id: string;
  label: string;
  group: Group;
  category: string;
  status: Status;
  /** Orden dentro del grupo en el selector. */
  order?: number;
  /** Par locked al abrir el modo (id de `pairs.ts`), o null para no tocar el par. */
  defaultPair: string | null;
  /** Estilo final por default (Spray, Stipple…), si el modo lo fija. */
  style?: string;
  /** Valores de parámetros compartidos que el modo fija al abrirse (airbrush, boil…). */
  paint?: Record<string, number | string>;
  dials: Dial[];
  optionalUnlocked: UnlockedFlag[];
  notes?: string;
}
