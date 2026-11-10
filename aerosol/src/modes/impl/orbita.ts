import type { ModeImpl } from './index';
import { baseFrame, bool, clear, drawCentered, fitFont, font, num, str } from './common';

// F · Órbita (Manifesto wordmark + tMSC1 School of Art): letras en anillos finos alrededor de un
// título quieto. Cada anillo entra girando y frena con un resorte (overshoot corto) hasta una pose
// legible. El ángulo es la solución cerrada del resorte amortiguado, así preview y export coinciden
// frame a frame sin integrar estado.

const SETTLE_S = 1.2;

/** Resorte amortiguado normalizado: 1 en t = 0, tiende a 0 con overshoot según el damping. */
export function spring(t: number, inertia: number, freq = 1.4): number {
  const zeta = Math.max(0.3, 1 - inertia * 0.6);
  const w = 2 * Math.PI * freq;
  if (zeta >= 1) return Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
}

function titleLines(text: string): string[] {
  // "Human + Motion" → ["Human", "+ Motion"], como el wordmark.
  const parts = text.split(/\s+(?=\+)/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

export const orbita: ModeImpl = {
  duration: (v) => SETTLE_S + num(v, 'hold'),
  key: (t, v) => JSON.stringify([t < SETTLE_S ? Math.round(t * 60) : 'hold', v.text, v.rings, v.radius, v.tracking, v.speed, v.inertia, v.title]),
  draw({ fig, crisp, w, h }, t, v) {
    clear(fig);
    clear(crisp);
    const unit = Math.min(w, h);
    const cx = w / 2;
    const cy = h / 2;
    const text = str(v, 'text');
    if (bool(v, 'title')) {
      const lines = titleLines(text);
      const widest = lines.reduce((a, b) => (b.length > a.length ? b : a), '');
      const px = Math.min(fitFont(fig, widest, 700, unit * 0.5), unit * 0.16);
      fig.fillStyle = '#fff';
      lines.forEach((line, i) => drawCentered(fig, line, 700, px, cx, cy + (i - (lines.length - 1) / 2) * px * 0.98));
    }
    const letters = [...text.replace(/[^\p{L}\p{N}]/gu, '')];
    const rings = Math.max(1, Math.round(num(v, 'rings')));
    const radius = unit * num(v, 'radius');
    const tracking = num(v, 'tracking');
    const lineW = Math.max(1, unit / 1080);
    const bead = unit * 0.024;
    const decay = spring(Math.min(t, SETTLE_S + 1), num(v, 'inertia'));
    crisp.strokeStyle = '#fff';
    crisp.fillStyle = '#fff';
    crisp.lineWidth = lineW;
    for (let r = 0; r < rings; r++) {
      const rx = radius * (1 - r * 0.14) * 1.12;
      const ry = rx * 0.58;
      const rot = -0.35 + r * 0.95;
      crisp.beginPath();
      crisp.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      crisp.stroke();
      // Cada anillo lleva un tramo seguido del texto, así la pose final se lee en orden.
      const per = Math.ceil(letters.length / rings);
      const mine = letters.slice(r * per, (r + 1) * per);
      const spin = (r % 2 ? -1 : 1) * Math.PI * 2 * num(v, 'speed') * (1 + 0.3 * r);
      const phase = spin * decay - Math.PI / 2 + r * 0.6;
      mine.forEach((ch, k) => {
        const a = phase + (k / Math.max(1, mine.length)) * Math.PI * 2 * tracking;
        const ex = Math.cos(a) * rx;
        const ey = Math.sin(a) * ry;
        const x = cx + ex * Math.cos(rot) - ey * Math.sin(rot);
        const y = cy + ex * Math.sin(rot) + ey * Math.cos(rot);
        // Cuenta: círculo fino con la letra adentro; tapa la órbita que pasa por debajo.
        crisp.save();
        crisp.globalCompositeOperation = 'destination-out';
        crisp.beginPath();
        crisp.arc(x, y, bead, 0, Math.PI * 2);
        crisp.fill();
        crisp.restore();
        crisp.beginPath();
        crisp.arc(x, y, bead, 0, Math.PI * 2);
        crisp.stroke();
        crisp.font = font(500, bead * 1.15);
        crisp.textAlign = 'center';
        crisp.textBaseline = 'middle';
        crisp.fillText(ch, x, y + bead * 0.06);
      });
    }
  },
  frame: () => baseFrame({ progress: 1 }),
};
