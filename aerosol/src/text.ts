/** Todo type sobre el canvas va en Archivo Narrow (variable 400–700). */
export const BRAND_FONT = 'Archivo Narrow Canvas';
const BRAND_FONT_URL = `${import.meta.env.BASE_URL}fonts/archivo-narrow-latin-wght-normal.woff2`;

/** Carga la fuente de marca desde public/fonts. Si falla, el texto usa una sans del sistema. */
export async function loadBrandFont(): Promise<boolean> {
  try {
    const face = new FontFace(BRAND_FONT, `url(${BRAND_FONT_URL})`, { weight: '400 700' });
    await face.load();
    document.fonts.add(face);
    return true;
  } catch {
    return false;
  }
}

export interface TextParams {
  text: string;
  size: number;
  lineGap: number;
  height: number;
}

/**
 * Dibuja el texto en blanco sobre transparente, al tamaño del render. El color lo pone el shader.
 * size es relativo al ancho del cuadro (o al alto, si el cuadro es apaisado).
 */
export function drawText(c: HTMLCanvasElement, w: number, h: number, p: TextParams): boolean {
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  const lines = p.text.split('\n').map((l) => l.trimEnd());
  if (!lines.some((l) => l.trim())) return false;
  const px = Math.min(w, h * 1.1) * p.size;
  ctx.font = `700 ${px}px "${BRAND_FONT}", "Arial Narrow", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  const lh = px * p.lineGap;
  const block = lh * (lines.length - 1);
  const cy = h * (1 - p.height) + 0; // height 1 = arriba
  const y0 = Math.min(Math.max(cy, px * 0.5 + block / 2), h - px * 0.5 - block / 2) - block / 2;
  lines.forEach((line, i) => {
    // Achica la línea si no entra en el ancho, con un margen del 4 %.
    const m = ctx.measureText(line).width;
    const max = w * 0.92;
    ctx.save();
    ctx.translate(w / 2, y0 + i * lh);
    if (m > max) ctx.scale(max / m, max / m);
    ctx.fillText(line, 0, 0);
    ctx.restore();
  });
  return true;
}
