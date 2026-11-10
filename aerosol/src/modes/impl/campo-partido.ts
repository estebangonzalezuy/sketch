import type { ModeImpl } from './index';
import { baseFrame, bool, clear, drawCentered, easeInOut, fitFont, num, str } from './common';

// D · Campo Partido (Color fields): dos campos planos del par cortados por una cuchilla. La cuchilla
// cruza el frame y se queda en Phase; el type, al ser cruzado, cambia de tinta.

const sweep = (v: Record<string, unknown>) => 1 / Math.max(0.2, Number(v.speed));

export const campoPartido: ModeImpl = {
  duration: (v) => sweep(v) + num(v, 'hold'),
  key: (_t, v) => JSON.stringify([v.typeOn, v.text]),
  draw({ fig, crisp, w, h }, _t, v) {
    clear(fig);
    clear(crisp);
    if (!bool(v, 'typeOn')) return;
    const text = str(v, 'text').trim();
    if (!text) return;
    fig.fillStyle = '#fff';
    drawCentered(fig, text, 700, fitFont(fig, text, 700, w * 0.56), w / 2, h / 2);
  },
  frame: (t, v) => {
    // Arranca fuera del cuadro (campo entero) y cruza hasta Phase.
    const k = easeInOut(t / sweep(v));
    return baseFrame({
      knife: { angle: num(v, 'angle'), phase: 1.02 + (num(v, 'phase') - 1.02) * k, soft: num(v, 'softness') },
    });
  },
};
