import type { AnimationTemplate } from '../../core/tool';

const animations: Record<string, AnimationTemplate> = {
  'Resolver': {
    tracks: { cell: [[0, 160, 'inOut'], [0.7, 1, 'hold'], [1, 1]] },
  },
  'Disolver en píxeles': {
    tracks: { cell: [[0.3, 1, 'in'], [1, 160]] },
  },
  'Pulso': {
    tracks: { cell: [[0, 8, 'inOut'], [0.5, 80, 'inOut'], [1, 8]] },
  },
  'Bayer que aparece': {
    values: { mode: 'bayer', cell: 8 },
    tracks: { contrast: [[0, 0.2, 'inOut'], [0.6, 1.6]], amount: [[0, 0, 'out'], [0.3, 1]] },
  },
};

export default animations;
