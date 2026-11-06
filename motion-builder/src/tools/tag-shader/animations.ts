import type { AnimationTemplate } from '../../core/tool';

const animations: Record<string, AnimationTemplate> = {
  'Zoom al detalle': {
    tracks: { zoom: [[0, 1, 'inOut'], [0.7, 8]], center: [[0, [0.5, 0.5], 'inOut'], [0.7, [0.42, 0.56]]] },
  },
  'Texto a marcas': {
    tracks: { mix: [[0.2, 0, 'inOut'], [0.8, 1]] },
  },
  'Disolver': {
    tracks: { density: [[0.3, 1, 'in'], [1, 0]] },
  },
  'Aparecer desde el fondo': {
    tracks: { density: [[0, 0, 'out'], [0.6, 1]] },
  },
  'Acelerar': {
    tracks: { speed: [[0, 0.02, 'in'], [1, 0.8]] },
  },
};

export default animations;
