import type { AnimationTemplate } from '../../core/tool';

const animations: Record<string, AnimationTemplate> = {
  'Aparecer': {
    opacity: [[0, 0, 'out'], [0.3, 1]],
    tracks: { luminanceThreshold: [[0, 0.8, 'out'], [0.5, 0.05]] },
  },
  'Revelar por luz': {
    values: { showPattern: true },
    tracks: { luminanceThreshold: [[0, 1, 'inOut'], [0.7, 0.05]] },
  },
  'Pulso de contraste': {
    values: { colorMode: 'color' },
    tracks: { contrast: [[0, 1, 'inOut'], [0.5, 3, 'inOut'], [1, 1]] },
  },
  'Disolver': {
    tracks: { luminanceThreshold: [[0.4, 0.05, 'in'], [1, 1]] },
    opacity: [[0.7, 1, 'in'], [1, 0]],
  },
};

export default animations;
