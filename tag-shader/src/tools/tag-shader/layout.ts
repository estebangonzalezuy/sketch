import * as THREE from 'three';
import { mulberry32 } from '../../core/random';

/**
 * Layout de bloques por fila.
 *
 * Cada fila es una tira periódica de bloques cuyo período es exactamente un
 * ancho de pantalla (coordenada x normalizada 0…1). Por eso:
 *  - nunca se ve la repetición dentro de una fila,
 *  - desplazar la fila un número ENTERO de períodos por loop cierra perfecto.
 *
 * buildLayout() genera la estructura base (determinística por seed).
 * LayoutTexture.update(motion) calcula los anchos animados para ese instante y
 * los escribe en una DataTexture que lee el fragment shader:
 *   texel (0, fila)   = [offset, cantidad de bloques, -, -]
 *   texel (i, fila)   = [inicio x, ancho, índice de palabra, random del bloque]
 */

export const TEX_W = 128; // 1 columna de info + hasta 127 bloques (búsqueda binaria de 7 pasos)
const MAX_BLOCKS = TEX_W - 1;

interface BlockBase {
  word: number;
  minW: number; // ancho mínimo = palabra + padding, en unidades de fila
  stretch: boolean; // si absorbe espacio sobrante (banda larga)
  weight: number; // cuánto espacio sobrante absorbe
  freq: number; // multiplicador entero de los ciclos de estiramiento
  phase: number;
  rand: number; // se usa para density (orden de apagado)
}

export interface RowBase {
  blocks: BlockBase[];
  sumMin: number;
  cycles: number; // entero con signo: dirección y velocidad relativa
  phaseOffset: number;
}

export function buildLayout(opts: {
  rows: number;
  rowLen: number; // ancho de pantalla en unidades de alto de fila
  widths: number[];
  pad: number;
  variation: number;
  speedVariety: number;
  maxMult: number;
  seed: number;
}): RowBase[] {
  const { rows, rowLen, widths, pad, variation, speedVariety, maxMult, seed } = opts;
  const out: RowBase[] = [];
  // Con variación alta, las palabras "naturales" llenan menos y el resto se reparte en bandas.
  const fillTarget = rowLen * (1 - variation * 0.7);
  const stretchProb = 0.15 + variation * 0.45;

  for (let r = 0; r < rows; r++) {
    const rng = mulberry32(seed * 7919 + r * 104729 + 13);
    const blocks: BlockBase[] = [];
    let sum = 0;
    let last = -1;
    while (blocks.length < MAX_BLOCKS) {
      let word = Math.floor(rng() * widths.length);
      if (widths.length > 1 && word === last) word = (word + 1) % widths.length;
      const minW = Math.min(widths[word] + pad * 2, rowLen);
      if (blocks.length > 0 && (sum + minW > fillTarget || sum + minW > rowLen)) break;
      const stretch = rng() < stretchProb;
      const w = rng();
      blocks.push({
        word,
        minW,
        stretch,
        weight: 0.25 + w * w * 2.5,
        freq: 1 + Math.floor(rng() * 2),
        phase: rng(),
        rand: rng(),
      });
      sum += minW;
      last = word;
    }
    // Siempre tiene que haber algún bloque que absorba el espacio sobrante.
    if (!blocks.some((b) => b.stretch)) blocks[Math.floor(rng() * blocks.length)].stretch = true;

    const dir = rng() < 0.5 ? -1 : 1;
    const mult = 1 + Math.floor(rng() * (1 + speedVariety * (Math.max(1, maxMult) - 1.001)));
    out.push({ blocks, sumMin: sum, cycles: dir * mult, phaseOffset: rng() });
  }
  return out;
}

export interface MotionState {
  travel: number; // ciclos recorridos desde el inicio del clip: la integral de la velocidad
  stretchTravel: number; // ciclos de estiramiento recorridos
  stretch: number;
  warp: (x: number) => number;
  stagger: number; // en ciclos
  staggerRandom: boolean;
  direction: 'aleatoria' | 'alternada' | 'izquierda' | 'derecha';
}

const hash1 = (r: number) => {
  const x = Math.sin(r * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export class LayoutTexture {
  texture: THREE.DataTexture;
  private data: Float32Array;
  private rows: RowBase[] = [];
  private rowLen = 1;

  constructor() {
    this.data = new Float32Array(TEX_W * 4);
    this.texture = this.makeTexture(1);
  }

  private makeTexture(h: number) {
    const t = new THREE.DataTexture(this.data, TEX_W, h, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = THREE.NearestFilter;
    t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }

  /** Devuelve true si la textura fue recreada (hay que reasignar el uniform). */
  setRows(rows: RowBase[], rowLen: number): boolean {
    this.rows = rows;
    this.rowLen = rowLen;
    const h = Math.max(1, rows.length);
    if (this.texture.image.height !== h) {
      this.texture.dispose();
      this.data = new Float32Array(TEX_W * h * 4);
      this.texture = this.makeTexture(h);
      return true;
    }
    return false;
  }

  /**
   * Escribe el estado del layout. Todo depende de los ciclos recorridos → reproducible.
   * warp: avance de las filas, con warp(x + 1) = warp(x) + 1 (pasos con pausa).
   * Cada fila lo lee desfasada `stagger × orden` → un número entero de ciclos sigue cerrando.
   */
  update(m: MotionState) {
    const TAU = Math.PI * 2;
    const d = this.data;
    const rowLen = this.rowLen;
    const { stretch: stretchAmt, stretchTravel } = m;
    const n = this.rows.length;
    for (let r = 0; r < n; r++) {
      const row = this.rows[r];
      const base = r * TEX_W * 4;
      const extra = Math.max(0, rowLen - row.sumMin);

      // Pesos animados: cada banda "respira" con un múltiplo entero de los ciclos de estiramiento.
      let sumW = 0;
      const ws = row.blocks.map((b) => {
        if (!b.stretch) return 0;
        const s = 0.5 + 0.5 * Math.sin(TAU * (b.freq * stretchTravel + b.phase));
        const w = b.weight * (1 - stretchAmt * 0.95 * s);
        sumW += w;
        return w;
      });

      let x = 0;
      for (let i = 0; i < row.blocks.length; i++) {
        const b = row.blocks[i];
        const width = b.minW + (extra * ws[i]) / sumW;
        const o = base + (i + 1) * 4;
        d[o] = x / rowLen;
        d[o + 1] = width / rowLen;
        d[o + 2] = b.word;
        d[o + 3] = b.rand;
        x += width;
      }

      const order = m.staggerRandom ? hash1(r) : n > 1 ? r / (n - 1) : 0;
      const dir = m.direction === 'aleatoria' ? Math.sign(row.cycles) : m.direction === 'alternada' ? (r % 2 ? -1 : 1) : m.direction === 'derecha' ? 1 : -1;
      const off = dir * Math.abs(row.cycles) * m.warp(m.travel - m.stagger * order) + row.phaseOffset;
      d[base] = off - Math.floor(off);
      d[base + 1] = row.blocks.length;
    }
    this.texture.needsUpdate = true;
  }
}

export type StepEase = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'expo';

const STEP_EASES: Record<StepEase, (u: number) => number> = {
  linear: (u) => u,
  easeIn: (u) => u * u * u,
  easeOut: (u) => 1 - (1 - u) ** 3,
  easeInOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
  expo: (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? 2 ** (20 * u - 10) / 2 : (2 - 2 ** (-20 * u + 10)) / 2),
};

/** Avance por pasos: n avances por ciclo, cada uno con una pausa y su curva. */
export function stepWarp(steps: number, hold: number, ease: StepEase) {
  const n = Math.max(1, Math.round(steps));
  const h = Math.min(0.95, Math.max(0, hold));
  return (x: number) => {
    const k = Math.floor(x * n);
    const u = Math.min(1, Math.max(0, (x * n - k - h) / (1 - h)));
    return (k + STEP_EASES[ease](u)) / n;
  };
}
