import type { ModeImpl } from './index';
import { baseFrame, bool, clamp01, clear, easeOutCubic, font, num, str } from './common';

// E · Grano de Papel (tMSC look + Manifesto): una frase que se sostiene sobre mucho papel. El grano
// encodea "esto es un still sobre una hoja": motas fijas y de baja densidad, no un filtro de suciedad.
// La grilla es una retícula fina en la tinta de figura, que el grano vuelve punteada.

const ENTER_S = 0.2;

export const granoPapel: ModeImpl = {
  duration: (v) => ENTER_S + num(v, 'hold'),
  key: (_t, v) => JSON.stringify([v.text, v.size, v.grid]),
  draw({ fig, crisp, w, h }, _t, v) {
    clear(fig);
    clear(crisp);
    const unit = Math.min(w, h);
    if (bool(v, 'grid')) {
      // Retícula a opacidad baja: el cuantizado a 2 tintas la convierte en puntos sueltos.
      const step = unit / 22;
      crisp.strokeStyle = 'rgba(255,255,255,0.22)';
      crisp.lineWidth = Math.max(1, unit / 1080);
      crisp.beginPath();
      for (let x = (w % step) / 2; x <= w; x += step) {
        crisp.moveTo(Math.round(x) + 0.5, 0);
        crisp.lineTo(Math.round(x) + 0.5, h);
      }
      for (let y = (h % step) / 2; y <= h; y += step) {
        crisp.moveTo(0, Math.round(y) + 0.5);
        crisp.lineTo(w, Math.round(y) + 0.5);
      }
      crisp.stroke();
    }
    const lines = str(v, 'text').split('\n');
    const px = unit * num(v, 'size');
    const lh = px * 1.02;
    const x = w * 0.08;
    let y = h * 0.42 - (lh * (lines.length - 1)) / 2;
    fig.fillStyle = '#fff';
    fig.textAlign = 'left';
    fig.textBaseline = 'middle';
    fig.font = font(700, px);
    for (const line of lines) {
      fig.fillText(line, x, y);
      y += lh;
    }
  },
  frame: (t, v) => {
    // El grano respira una vez (sube y se asienta) y la frase entra en 0.2 s.
    const breath = Math.sin(Math.PI * clamp01(t / 1.2));
    return baseFrame({
      progress: easeOutCubic(t / ENTER_S),
      photo: bool(v, 'photo') ? 1 : 0,
      paper: num(v, 'density') * (1 + 0.8 * breath),
    });
  },
};
