import { describe, expect, it } from 'vitest';
import { blueNoise } from '../src/gl/bluenoise';

describe('blue noise', () => {
  const size = 32;
  const t = blueNoise(size);

  it('uses every threshold level evenly', () => {
    const hist = new Array(256).fill(0);
    for (const v of t) hist[v]++;
    expect(Math.min(...hist)).toBe(Math.max(...hist));
  });

  it('spreads a 10% threshold without neighbours touching much', () => {
    // Las celdas por debajo de un umbral bajo no deberían estar pegadas (eso es blue noise).
    let on = 0;
    let touching = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (t[y * size + x] >= 26) continue;
        on++;
        const right = t[y * size + ((x + 1) % size)] < 26;
        const down = t[((y + 1) % size) * size + x] < 26;
        if (right || down) touching++;
      }
    }
    expect(on).toBeGreaterThan(80);
    expect(touching / on).toBeLessThan(0.1);
  });
});
