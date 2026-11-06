import type { AnimationTemplate } from '../../core/tool';

const animations: Record<string, AnimationTemplate> = {
  'Entrada por carácter': {
    values: { unitBy: 'chars', order: 'forward' },
    tracks: { reveal: [[0, 0, 'out'], [0.6, 1]] },
  },
  'Aleatorio': {
    values: { unitBy: 'chars', order: 'random', stagger: 0.8 },
    tracks: { reveal: [[0, 0, 'linear'], [0.7, 1]] },
  },
  'Palabra por palabra': {
    values: { unitBy: 'words', order: 'forward', rise: 80 },
    tracks: { reveal: [[0, 0, 'out'], [0.65, 1]] },
  },
  'Entra y sale': {
    tracks: { reveal: [[0, 0, 'out'], [0.35, 1, 'hold'], [0.7, 1, 'in'], [1, 0]] },
  },
  'Tracking que cierra': {
    opacity: [[0, 0, 'out'], [0.2, 1]],
    tracks: { tracking: [[0, 0.4, 'out'], [0.7, 0]] },
  },
};

export default animations;
