// Numeral híbrido mínimo (rasgo del Figma Q3): el contorno exterior se cuantiza a una grilla en
// world space (stair-step) y las contraformas quedan vectoriales y limpias. No hay motor Q3 en este
// repo; si llega, este archivo es el punto para reemplazarlo.

export interface HybridOpts {
  /** Lado de la celda en px. */
  cell: number;
  /** 0 = todo vector; 1 = todo el contorno en grilla; en el medio, la grilla baja desde arriba. */
  hybrid: number;
}

/**
 * Recibe la máscara vectorial del glifo (canal r, w×h) y devuelve la máscara híbrida (0/1).
 * También devuelve la caja del glifo.
 */
export function hybridMask(src: Uint8ClampedArray, w: number, h: number, o: HybridOpts): { mask: Uint8Array; box: [number, number, number, number] } {
  const n = w * h;
  const glyph = new Uint8Array(n);
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < n; i++) {
    if (src[i * 4] > 127) {
      glyph[i] = 1;
      const x = i % w;
      const y = (i / w) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const mask = new Uint8Array(n);
  if (x1 < 0) return { mask, box: [0, 0, 0, 0] };

  // Contraformas: fondo que no se alcanza desde el borde del cuadro.
  const outside = new Uint8Array(n);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!glyph[i] && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < n - w) push(i + w);
  }

  // Grilla anclada al cuadro (world space), no al glifo.
  const cell = Math.max(2, Math.round(o.cell));
  const cut = y0 + (y1 - y0 + 1) * Math.min(1, Math.max(0, o.hybrid));
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  const on = new Uint8Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      let hit = 0;
      let tot = 0;
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          const x = Math.min(w - 1, cx * cell + Math.floor(((sx + 0.5) * cell) / 4));
          const y = Math.min(h - 1, cy * cell + Math.floor(((sy + 0.5) * cell) / 4));
          hit += glyph[y * w + x];
          tot++;
        }
      }
      on[cy * cols + cx] = hit * 2 >= tot ? 1 : 0;
    }
  }
  for (let y = 0; y < h; y++) {
    const pixelZone = y < cut;
    const row = ((y / cell) | 0) * cols;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const counter = !glyph[i] && !outside[i];
      const inShape = pixelZone ? on[row + ((x / cell) | 0)] === 1 : glyph[i] === 1;
      mask[i] = inShape && !counter ? 1 : 0;
    }
  }
  return { mask, box: [x0, y0, x1, y1] };
}
