/**
 * Bitmap helpers. Drawing at 1/cell scale lets the rasteriser's anti-aliasing compute area
 * coverage per cell, which we then snap back to the piece's two colours.
 */

type Ctx = OffscreenCanvasRenderingContext2D;
type Draw = (ctx: Ctx) => void;

const pool = new Map<string, OffscreenCanvas>();

export function scratch(name: string, w: number, h: number): Ctx {
  let c = pool.get(name);
  if (!c) {
    c = new OffscreenCanvas(w, h);
    pool.set(name, c);
  }
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export type Grid = { cols: number; rows: number; ox: number; oy: number; cell: number };

/** A cell grid centred on the frame, so cells grow and shrink around the middle. */
export function gridFor(w: number, h: number, cell: number): Grid {
  const cols = Math.ceil(w / cell / 2) * 2 + 2;
  const rows = Math.ceil(h / cell / 2) * 2 + 2;
  return { cols, rows, cell, ox: w / 2 - (cols / 2) * cell, oy: h / 2 - (rows / 2) * cell };
}

function drawSmall(name: string, w: number, h: number, cell: number, draw: Draw) {
  const g = gridFor(w, h, cell);
  const s = scratch(name, g.cols, g.rows);
  s.setTransform(1 / cell, 0, 0, 1 / cell, -g.ox / cell, -g.oy / cell);
  draw(s);
  s.setTransform(1, 0, 0, 1, 0, 0);
  return { g, s };
}

/** Coverage (0..1) per cell of whatever `draw` paints, any colour. */
export function coverage(w: number, h: number, cell: number, draw: Draw) {
  const { g, s } = drawSmall('coverage', w, h, cell, draw);
  const px = s.getImageData(0, 0, g.cols, g.rows).data;
  const data = new Float32Array(g.cols * g.rows);
  for (let i = 0; i < data.length; i++) data[i] = px[i * 4 + 3] / 255;
  return { ...g, data };
}

/**
 * Draws `draw` as a hard bitmap with square cells. Every opaque cell snaps to the nearest of
 * `colors`; cells under 50 % coverage stay transparent.
 */
export function pixelate(
  ctx: CanvasRenderingContext2D | Ctx,
  w: number,
  h: number,
  cell: number,
  colors: string[],
  draw: Draw,
) {
  if (cell <= 1.01) {
    draw(ctx as Ctx);
    return;
  }
  const { g, s } = drawSmall('pixelate', w, h, cell, draw);
  const img = s.getImageData(0, 0, g.cols, g.rows);
  const d = img.data;
  const rgb = colors.map(hexToRgb);
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a < 128) {
      d[i + 3] = 0;
      continue;
    }
    // Canvas pixels are un-premultiplied on read, so these are true colours.
    let best = rgb[0];
    let bestD = Infinity;
    for (const c of rgb) {
      const dd = (d[i] - c[0]) ** 2 + (d[i + 1] - c[1]) ** 2 + (d[i + 2] - c[2]) ** 2;
      if (dd < bestD) {
        bestD = dd;
        best = c;
      }
    }
    d[i] = best[0];
    d[i + 1] = best[1];
    d[i + 2] = best[2];
    d[i + 3] = 255;
  }
  s.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s.canvas, g.ox, g.oy, g.cols * g.cell, g.rows * g.cell);
  ctx.restore();
}
