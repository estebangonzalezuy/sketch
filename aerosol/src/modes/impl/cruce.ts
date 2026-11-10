import type { ModeImpl } from './index';
import { hybridMask } from '../hybrid';
import { baseFrame, clear, drawCentered, easeInOut, easeOutCubic, fitFont, num, str } from './common';

// C · Cruce: un solo afiche que cruza rasgos. Un numeral protagonista con mucho aire (tMSC1) es el
// dato (DataViz1); su contorno es híbrido pixel/vector (Figma Q3); se rellena con dither de 1 bit
// cuya densidad es el valor (Hex); una cuchilla parte el campo e invierte figura y fondo (Color
// fields); el vacío lleva grano de papel (editorial).

const REVEAL_S = 0.7;
const KNIFE_S = 0.5;

export const cruce: ModeImpl = {
  duration: (v) => REVEAL_S + KNIFE_S + num(v, 'hold'),
  key: (_t, v) => JSON.stringify([v.value, v.weight, v.scale, v.posX, v.posY, v.cell, v.hybrid, v.threshold]),
  draw({ fig, crisp, w, h }, _t, v) {
    clear(crisp);
    clear(fig);
    const text = str(v, 'value').trim() || '0';
    const weight = num(v, 'weight');
    const px = fitFont(fig, text, weight, w * num(v, 'scale'));
    fig.fillStyle = '#fff';
    drawCentered(fig, text, weight, px, num(v, 'posX') * w, (1 - num(v, 'posY')) * h);
    const img = fig.getImageData(0, 0, w, h);
    const { mask } = hybridMask(img.data, w, h, { cell: num(v, 'cell') * Math.min(w, h), hybrid: num(v, 'hybrid') });
    // La densidad del relleno ES el dato (Threshold): el stipple la convierte en puntos.
    const k = Math.round(255 * num(v, 'threshold'));
    for (let i = 0; i < mask.length; i++) {
      const c = mask[i] ? k : 0;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = c;
      img.data[i * 4 + 3] = 255;
    }
    fig.putImageData(img, 0, 0);
  },
  frame: (t, v) => {
    // 1. El numeral aparece subiendo el umbral del dither hasta el valor.
    // 2. La cuchilla entra desde arriba hasta Phase y da vuelta figura/fondo.
    const knifeK = easeInOut((t - REVEAL_S) / KNIFE_S);
    const target = num(v, 'phase');
    return baseFrame({
      gain: easeOutCubic(t / REVEAL_S),
      knife: { angle: num(v, 'angle'), phase: 1.02 + (target - 1.02) * knifeK, soft: 0 },
      paper: 0.006,
    });
  },
};
