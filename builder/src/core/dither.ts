// Dither a 2 colores exactos. La textura codifica densidad, no es un filtro.

function bayer(n: number): Float32Array {
  // matriz de Bayer n×n (n potencia de 2), umbrales en (0,1)
  let m = [[0]];
  while (m.length < n) {
    const s = m.length;
    const next: number[][] = Array.from({ length: s * 2 }, () => new Array(s * 2).fill(0));
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const v = m[y][x] * 4;
        next[y][x] = v;
        next[y][x + s] = v + 2;
        next[y + s][x] = v + 3;
        next[y + s][x + s] = v + 1;
      }
    m = next;
  }
  const out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out[y * n + x] = (m[y][x] + 0.5) / (n * n);
  return out;
}

export const BAYER4 = bayer(4);
export const BAYER8 = bayer(8);

/**
 * v: valores 0..1 por píxel (0 = vacío, queda bg siempre). Escribe en `data` (RGBA) solo bg o fg.
 * umbral: 0..1, corre el punto de corte (0,5 = neutro).
 */
export function ditherTo(
  v: Float32Array,
  w: number,
  h: number,
  mode: "bayer 4" | "bayer 8" | "floyd",
  umbral: number,
  bg: [number, number, number],
  fg: [number, number, number],
  data: Uint8ClampedArray,
) {
  const shift = 0.5 - umbral;
  const put = (i: number, on: boolean) => {
    const c = on ? fg : bg;
    const o = i * 4;
    data[o] = c[0];
    data[o + 1] = c[1];
    data[o + 2] = c[2];
    data[o + 3] = 255;
  };
  if (mode === "floyd") {
    const e = new Float32Array(v); // copia: el error se difunde acá
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (v[i] <= 0) {
          put(i, false);
          continue;
        }
        const old = e[i] + shift;
        const on = old > 0.5;
        put(i, on);
        const err = e[i] - (on ? 1 : 0); // sin el corrimiento: si no, la difusión lo anula
        if (x + 1 < w) e[i + 1] += (err * 7) / 16;
        if (y + 1 < h) {
          if (x > 0) e[i + w - 1] += (err * 3) / 16;
          e[i + w] += (err * 5) / 16;
          if (x + 1 < w) e[i + w + 1] += err / 16;
        }
      }
    }
    return;
  }
  const n = mode === "bayer 8" ? 8 : 4;
  const m = n === 8 ? BAYER8 : BAYER4;
  const mask = n - 1;
  for (let y = 0; y < h; y++) {
    const row = (y & mask) * n;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const val = v[i];
      put(i, val > 0 && val + shift > m[row + (x & mask)]);
    }
  }
}
