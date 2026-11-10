// Blue noise por void-and-cluster (Ulichney 1993), generado una vez al arrancar.
// Devuelve el rango de cada celda (0..n-1) escalado a 0..255: un umbral de dither sin patrón visible.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function blueNoise(size = 64, sigma = 1.5, seed = 7): Uint8Array {
  const n = size * size;
  const lut = new Float32Array(n);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.min(x, size - x);
      const dy = Math.min(y, size - y);
      lut[y * size + x] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
    }
  }
  const energy = new Float32Array(n);
  const bits = new Uint8Array(n);
  const splat = (i: number, sign: number) => {
    const px = i % size;
    const py = (i / size) | 0;
    for (let y = 0; y < size; y++) {
      const ey = ((y - py + size) % size) * size;
      const row = y * size;
      for (let x = 0; x < size; x++) energy[row + x] += sign * lut[ey + ((x - px + size) % size)];
    }
  };
  const extreme = (want: number, max: boolean) => {
    let best = -1;
    let bv = max ? -Infinity : Infinity;
    for (let i = 0; i < n; i++) {
      if (bits[i] !== want) continue;
      if (max ? energy[i] > bv : energy[i] < bv) {
        bv = energy[i];
        best = i;
      }
    }
    return best;
  };

  // Patrón inicial: ~10 % de unos al azar, después se reparte (cluster más apretado → hueco más grande).
  const rnd = mulberry32(seed);
  const ones = Math.round(n * 0.1);
  for (let k = 0; k < ones; ) {
    const i = Math.floor(rnd() * n);
    if (!bits[i]) {
      bits[i] = 1;
      splat(i, 1);
      k++;
    }
  }
  for (let guard = 0; guard < n; guard++) {
    const tight = extreme(1, true);
    bits[tight] = 0;
    splat(tight, -1);
    const voidI = extreme(0, false);
    if (voidI === tight) {
      bits[tight] = 1;
      splat(tight, 1);
      break;
    }
    bits[voidI] = 1;
    splat(voidI, 1);
  }

  const rank = new Int32Array(n);
  const start = bits.slice();
  const startEnergy = energy.slice();
  // Fase 1: rangos de los unos, sacando el cluster más apretado cada vez.
  for (let r = ones - 1; r >= 0; r--) {
    const i = extreme(1, true);
    bits[i] = 0;
    splat(i, -1);
    rank[i] = r;
  }
  // Fase 2: desde el patrón inicial, llenar el hueco más grande cada vez.
  bits.set(start);
  energy.set(startEnergy);
  for (let r = ones; r < n; r++) {
    const i = extreme(0, false);
    bits[i] = 1;
    splat(i, 1);
    rank[i] = r;
  }
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.floor((rank[i] * 256) / n);
  return out;
}
