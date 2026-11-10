import type { ModeImpl } from './index';
import { baseFrame, bool, clear, drawCentered, easeInOut, fitFont, num, str } from './common';

// G · Dither Field (Hex, Propuesta): un campo de dither de 1 bit del par que ya es sistema. La palabra
// no se dibuja con un borde: se lee porque su densidad (Threshold) es distinta de la del campo. Un
// barrido revela el campo y la palabra; después, still.

const SWEEP_S = 0.8;

export const ditherField: ModeImpl = {
  duration: (v) => SWEEP_S + num(v, 'hold'),
  key: (_t, v) => JSON.stringify([v.typeOn, v.text, v.threshold]),
  draw({ fig, crisp, w, h }, _t, v) {
    clear(crisp);
    // Campo: un gradiente diagonal bajo de densidad (0.08 → 0.42), el "sistema" sobre el que vive el type.
    const g = fig.createLinearGradient(0, h, w, 0);
    g.addColorStop(0, 'rgb(20,20,20)');
    g.addColorStop(1, 'rgb(107,107,107)');
    fig.fillStyle = g;
    fig.fillRect(0, 0, w, h);
    if (!bool(v, 'typeOn')) return;
    const text = str(v, 'text').trim();
    if (!text) return;
    const k = Math.round(255 * num(v, 'threshold'));
    fig.fillStyle = `rgb(${k},${k},${k})`;
    drawCentered(fig, text, 700, fitFont(fig, text, 700, w * 0.78), w / 2, h / 2);
  },
  frame: (t, v) => baseFrame({ progress: easeInOut(t / SWEEP_S) * 1.04, reveal: 1, sort: bool(v, 'sort') }),
};
