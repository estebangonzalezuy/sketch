import type { DialValues } from '../types';

/** Lo que un modo que dibuja su propia figura le aporta al render. Se completa con el primer modo. */
export interface ModeImpl {
  /** Largo del loop en segundos (intro + Hold). */
  duration(v: DialValues): number;
}

export const IMPLS: Record<string, ModeImpl> = {};
