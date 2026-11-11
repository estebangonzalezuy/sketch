import { parse, type Font } from 'opentype.js';
import { FONT_FAMILY, FONT_WEIGHTS, fontUrl, type FontWeight } from './tokens';

let canvasFont: Promise<void> | null = null;

/** Registers self-hosted Archivo Narrow for canvas text. Resolves when every weight is ready. */
export function loadArchivo(): Promise<void> {
  canvasFont ??= Promise.all(
    FONT_WEIGHTS.map(async (w) => {
      const face = new FontFace(FONT_FAMILY, `url(${fontUrl(w, 'woff2')}) format('woff2')`, {
        weight: String(w),
      });
      document.fonts.add(await face.load());
    }),
  ).then(() => undefined);
  return canvasFont;
}

const outlines = new Map<FontWeight, Promise<Font>>();

/** Real glyph outlines (opentype.js) for one weight of Archivo Narrow. */
export function loadOutlines(weight: FontWeight): Promise<Font> {
  let p = outlines.get(weight);
  if (!p) {
    p = fetch(fontUrl(weight, 'woff'))
      .then((r) => {
        if (!r.ok) throw new Error(`Font ${weight} failed to load (${r.status})`);
        return r.arrayBuffer();
      })
      .then((buf) => parse(buf));
    outlines.set(weight, p);
  }
  return p;
}

/** A Google Fonts family plus the styles a tool may ask canvas for. */
export type WebFont = {
  family: string;
  weights: number[];
  italic?: boolean;
  /** Width axis values (canvas `fontStretch` keywords) for families with a wdth axis. */
  stretches?: CanvasFontStretch[];
  /** Raw CSS2 `family=` value, for variable axes (e.g. `Archivo:wdth,wght@62..125,100..900`). */
  spec?: string;
};

const injected = new Set<string>();

function cssUrl(f: WebFont) {
  if (f.spec) return `family=${f.spec.replace(/ /g, '+')}`;
  const fam = f.family.trim().replace(/ /g, '+');
  const ws = [...new Set(f.weights)].sort((a, b) => a - b);
  if (f.italic)
    return `family=${fam}:ital,wght@${ws
      .map((w) => `0,${w}`)
      .concat(ws.map((w) => `1,${w}`))
      .join(';')}`;
  return ws.length === 1 && ws[0] === 400 ? `family=${fam}` : `family=${fam}:wght@${ws.join(';')}`;
}

/**
 * Loads Google Fonts through the CSS2 API and waits until canvas can draw them. Families that
 * fail to load are returned so the tool can drop them from its pool instead of drawing fallbacks.
 */
export async function loadGoogleFonts(
  fonts: WebFont[],
  text = 'Aa',
): Promise<{ failed: string[] }> {
  for (const f of fonts) {
    const href = `https://fonts.googleapis.com/css2?${cssUrl(f)}&display=block`;
    if (injected.has(href)) continue;
    injected.add(href);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    await new Promise<void>((res) => {
      link.onload = () => res();
      link.onerror = () => res();
    });
  }
  const failed: string[] = [];
  await Promise.all(
    fonts.map(async (f) => {
      const probes = f.weights.flatMap((w) =>
        f.italic
          ? [`${w} 40px "${f.family}"`, `italic ${w} 40px "${f.family}"`]
          : [`${w} 40px "${f.family}"`],
      );
      const results = await Promise.all(
        probes.map((p) => document.fonts.load(p, text).catch(() => [])),
      );
      if (results.every((r) => r.length === 0)) failed.push(f.family);
    }),
  );
  return { failed };
}
