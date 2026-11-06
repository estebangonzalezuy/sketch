import * as THREE from 'three';

/**
 * Atlas de palabras dibujado en un canvas 2D.
 * Cada palabra ocupa una celda de CELL_W × CELL_H px; hay COLS columnas.
 * La altura de celda corresponde 1:1 al alto de una fila del mosaico,
 * así el shader puede mapear "unidades de fila" → px del atlas directamente.
 * Texto blanco sobre transparente: el shader solo usa el canal alpha.
 */
// Celdas grandes para que el texto siga nítido con zoom alto en 4K.
export const CELL_W = 2048;
export const CELL_H = 256;
export const COLS = 2;
const SAFE_W = CELL_W - 32; // margen para que el mipmap no sangre a la columna vecina

export class WordAtlas {
  readonly canvas = document.createElement('canvas');
  readonly texture: THREE.CanvasTexture;
  maxTextureSize = 8192; // el de la GPU: lo asigna la tool antes de construir
  /** Ancho de cada palabra en unidades de alto de fila. */
  widths: number[] = [];
  count = 0;

  constructor() {
    this.canvas.width = CELL_W * COLS;
    this.canvas.height = CELL_H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.anisotropy = 4;
  }

  /** Máximo de palabras que entran según el tamaño de textura de la GPU. */
  get maxWords() {
    return Math.floor(Math.min(this.maxTextureSize, 8192) / CELL_H) * COLS;
  }

  async build(words: string[], font: { family: string; weight: number; italic: boolean; capHeight: number }) {
    const list = words.map((w) => w.trim().toUpperCase()).filter(Boolean).slice(0, this.maxWords);
    if (list.length === 0) list.push('TAG');
    const fontStr = (size: number) => `${font.italic ? 'italic ' : ''}${font.weight} ${size}px "${font.family}"`;
    await document.fonts.load(fontStr(100), list.join(''));

    const rowsNeeded = Math.ceil(list.length / COLS);
    this.canvas.width = CELL_W * COLS;
    this.canvas.height = rowsNeeded * CELL_H;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })!; // raster por CPU: por GPU varía entre corridas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Tamaño de fuente para que la altura de mayúscula sea capHeight × alto de fila.
    ctx.font = fontStr(100);
    const capRatio = ctx.measureText('H').actualBoundingBoxAscent / 100 || 0.7;
    const capPx = font.capHeight * CELL_H;
    const size = capPx / capRatio;
    ctx.font = fontStr(size);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    this.widths = [];
    list.forEach((word, i) => {
      const x0 = (i % COLS) * CELL_W;
      const y0 = Math.floor(i / COLS) * CELL_H;
      const baseline = y0 + CELL_H / 2 + capPx / 2;
      let w = ctx.measureText(word).width;
      ctx.save();
      // Si una palabra no entra en la celda, se condensa horizontalmente.
      if (w > SAFE_W) {
        ctx.translate(x0, 0);
        ctx.scale(SAFE_W / w, 1);
        ctx.fillText(word, 0, baseline);
        w = SAFE_W;
      } else {
        ctx.fillText(word, x0, baseline);
      }
      ctx.restore();
      this.widths.push(w / CELL_H);
    });

    this.count = list.length;
    // El tamaño del canvas puede cambiar: hay que recrear la textura en la GPU.
    this.texture.dispose();
    this.texture.needsUpdate = true;
  }
}
