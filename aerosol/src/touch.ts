import type { Stamp } from './gl/renderer';

export interface TouchEvt {
  /** Tiempo de la línea de tiempo, en segundos. */
  t: number;
  x: number;
  y: number;
  type: 'down' | 'move' | 'up';
}

/**
 * Convierte gestos (en coordenadas de cuadro 0..1, y hacia arriba) en estampas de smear.
 * El mismo objeto se usa para el puntero en vivo y para reproducir gestos grabados.
 */
export class Brush {
  private down = false;
  private x = 0;
  private y = 0;
  private stamps: Stamp[] = [];

  constructor(private aspect: () => number, private radius: () => number) {}

  feed(e: Pick<TouchEvt, 'x' | 'y' | 'type'>): void {
    if (e.type === 'down') {
      this.down = true;
      this.x = e.x;
      this.y = e.y;
      return;
    }
    if (e.type === 'up') {
      this.down = false;
      return;
    }
    if (!this.down) return;
    const dx = e.x - this.x;
    const dy = e.y - this.y;
    // Subdivide para que cada estampa mueva como mucho 1/4 del radio.
    const len = Math.hypot(dx * this.aspect(), dy);
    const steps = Math.min(24, Math.max(1, Math.ceil(len / (this.radius() * 0.25))));
    for (let i = 1; i <= steps; i++) {
      this.stamps.push({
        x: this.x + (dx * i) / steps,
        y: this.y + (dy * i) / steps,
        dx: dx / steps,
        dy: dy / steps,
      });
    }
    this.x = e.x;
    this.y = e.y;
  }

  take(): Stamp[] {
    const s = this.stamps;
    this.stamps = [];
    return s;
  }

  reset(): void {
    this.down = false;
    this.stamps = [];
  }
}

/** Eventos grabados con t en [t0, t1). Si el rango da la vuelta al loop, incluye ambos tramos. */
export function eventsBetween(events: TouchEvt[], t0: number, t1: number, total: number): TouchEvt[] {
  if (t1 >= t0) return events.filter((e) => e.t >= t0 && e.t < t1);
  return [...events.filter((e) => e.t >= t0 && e.t < total), ...events.filter((e) => e.t < t1)];
}
