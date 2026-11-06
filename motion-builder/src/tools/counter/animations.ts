import type { AnimationTemplate } from '../../core/tool';

const animations: Record<string, AnimationTemplate> = {
  'Subida rápida': {
    tracks: {
      fade: [[0, 0, 'out'], [0.08, 1]],
      progress: [[0, 0, 'out'], [0.7, 1]],
      captionReveal: [[0.6, 0, 'out'], [0.75, 1]],
    },
  },
  'Odómetro': {
    values: { mode: 'odometer' },
    tracks: {
      fade: [[0, 0, 'out'], [0.06, 1]],
      progress: [[0.04, 0, 'inOut'], [0.8, 1]],
      captionReveal: [[0.75, 0, 'out'], [0.9, 1]],
    },
  },
  'Golpe al llegar': {
    tracks: {
      progress: [[0, 0, 'in'], [0.5, 1]],
      scale: [[0.5, 1, 'back'], [0.56, 1.18, 'inOut'], [0.7, 1]],
      fade: [[0, 0, 'out'], [0.1, 1]],
      captionReveal: [[0.6, 0, 'out'], [0.75, 1]],
    },
  },
};

export default animations;
