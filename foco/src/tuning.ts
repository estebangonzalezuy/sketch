import type { Transition } from 'motion/react';
import type { Config, Curve, Tuning } from './types';

/** Los valores de fábrica. Se afinan en vivo desde el panel oculto. */
export const TUNING: Tuning = {
  fondo: { type: 'easing', duration: 0.28, ease: [0.2, 0, 0, 1] },
  texto: { type: 'spring', visualDuration: 0.55, bounce: 0.1 },
  escalonado: 0.05,
  salida: { type: 'easing', duration: 0.2, ease: [0.4, 0, 1, 1] },
  permanencia: 6,
  panel: { type: 'spring', visualDuration: 0.28, bounce: 0.08 },
};

export function tuningOf(config: Config | null): Tuning {
  return { ...TUNING, ...(config?.tuning ?? {}) };
}

/** De una curva de DialKit a una transición de Motion. */
export function motionOf(curve: Curve, delay = 0): Transition {
  if (curve.type === 'easing') return { duration: curve.duration, ease: curve.ease, delay };
  const { type: _type, ...spring } = curve;
  return { type: 'spring', ...spring, delay };
}
