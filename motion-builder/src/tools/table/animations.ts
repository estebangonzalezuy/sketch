import type { AnimationTemplate } from '../../core/tool';

const animations: Record<string, AnimationTemplate> = {
  'Filas en cascada': {
    tracks: {
      header: [[0, 0, 'out'], [0.12, 1]],
      reveal: [[0.08, 0, 'linear'], [0.75, 1]],
      highlight: [[0.75, 0, 'inOut'], [0.9, 1]],
    },
  },
  'Destacar la columna': {
    tracks: {
      header: [[0, 0, 'out'], [0.1, 1]],
      reveal: [[0.06, 0, 'linear'], [0.45, 1]],
      highlight: [[0.5, 0, 'inOut'], [0.7, 1]],
      dim: [[0.7, 0, 'inOut'], [0.85, 1]],
    },
  },
  'Todo de golpe': {
    opacity: [[0, 0, 'out'], [0.12, 1]],
    tracks: { reveal: [[0, 0.4, 'out'], [0.2, 1]], highlight: [[0.2, 0, 'out'], [0.4, 1]] },
  },
};

export default animations;
