import type { ModeImpl } from './index';
import { FILLS, baseFrame, clear, drawCentered, easeOutCubic, fitFont, num, str } from './common';

// A · Una Palabra (Cosmos tMSC1): una palabra protagonista en un campo casi vacío. El spray llena
// el glifo (o el campo) en ~0.6 s y después la pieza se queda quieta.
const FILL_S = 0.6;

export const unaPalabra: ModeImpl = {
  duration: (v) => FILL_S + num(v, 'hold'),
  key: (_t, v) => JSON.stringify([v.text, v.weight, v.scale, v.posX, v.posY, v.bleed]),
  draw({ fig, crisp, w, h }, _t, v) {
    clear(fig);
    clear(crisp);
    const text = str(v, 'text').trim() || ' ';
    const weight = num(v, 'weight');
    // Scale es el ancho de la palabra respecto del cuadro; Bleed la agranda hasta recortarla a sangre.
    const width = w * num(v, 'scale') * (1 + num(v, 'bleed') * 2.2);
    const px = fitFont(fig, text, weight, width);
    fig.fillStyle = '#fff';
    drawCentered(fig, text, weight, px, num(v, 'posX') * w, (1 - num(v, 'posY')) * h);
  },
  frame: (t, v) => baseFrame({ progress: easeOutCubic(t / FILL_S), fill: Math.max(0, FILLS.indexOf(str(v, 'fill'))) }),
};
