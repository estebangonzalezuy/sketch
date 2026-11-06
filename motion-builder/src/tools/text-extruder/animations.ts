import type { AnimationTemplate } from '../../core/tool';

const animations: Record<string, AnimationTemplate> = {
  'Giro completo': {
    values: { floor: false },
    tracks: { rotY: [[0, -180, 'inOut'], [1, 180]] },
  },
  'Vaivén': {
    values: { floor: false },
    tracks: { rotY: [[0, -35, 'inOut'], [0.5, 35, 'inOut'], [1, -35]] },
  },
  'Acercamiento': {
    tracks: { distance: [[0, 2.4, 'out'], [0.8, 1]], rotX: [[0, 20, 'out'], [0.8, 0]] },
  },
  'Onda': {
    values: { anim: 'wave', floor: false, speed: 0.3 },
    tracks: { amount: [[0, 0, 'out'], [0.3, 0.3, 'hold'], [0.7, 0.3, 'in'], [1, 0]] },
  },
  'Caída al piso': {
    values: { floor: true },
    tracks: { rotX: [[0, -70, 'back'], [0.4, 0]] },
    opacity: [[0, 0, 'out'], [0.1, 1]],
  },
};

export default animations;
