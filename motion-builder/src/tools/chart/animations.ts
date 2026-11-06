import type { AnimationTemplate } from '../../core/tool';

const animations: Record<string, AnimationTemplate> = {
  'Trazo progresivo': {
    tracks: {
      axes: [[0, 0, 'out'], [0.15, 1]],
      progress: [[0.1, 0, 'inOut'], [0.8, 1]],
    },
  },
  'Barras que suben': {
    values: { type: 'bars' },
    tracks: {
      axes: [[0, 0, 'out'], [0.15, 1]],
      progress: [[0.1, 0, 'out'], [0.75, 1]],
    },
  },
  'Puntos y foco final': {
    tracks: {
      axes: [[0, 0, 'out'], [0.12, 1]],
      progress: [[0.08, 0, 'inOut'], [0.6, 1]],
      focus: [[0.68, 0, 'inOut'], [0.85, 1]],
    },
  },
  'Primero la forma, después los datos': {
    tracks: {
      axes: [[0, 0, 'out'], [0.12, 1]],
      labels: [[0.6, 0, 'out'], [0.8, 1]],
      progress: [[0.1, 0, 'inOut'], [0.6, 1]],
    },
  },
};

export default animations;
