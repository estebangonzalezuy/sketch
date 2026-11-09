import brand from './palette.json';

export type RGB = [number, number, number]; // 0..1, sRGB

export interface Palette {
  colors: RGB[];
  names: string[];
  presets: Record<PresetName, number[]>;
  paper: RGB;
  text: number;
}

export const PRESET_NAMES = ['Full', 'Primary', 'Duo', 'Warm', 'Cool'] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

export const BRAND_NAME: string = brand.name;

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function luma([r, g, b]: RGB): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hueSat([r, g, b]: RGB): { h: number; s: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: h * 60, s };
}

export function brandPalette(): Palette {
  const colors = brand.colors.map((c) => hexToRgb(c.hex));
  const presets = { ...derivePresets(colors) };
  for (const name of PRESET_NAMES) {
    const p = (brand.presets as Partial<Record<string, number[]>>)[name];
    if (p) presets[name] = p.filter((i) => i >= 0 && i < colors.length);
  }
  return {
    colors,
    names: brand.colors.map((c) => c.name),
    presets,
    paper: hexToRgb(brand.paper),
    text: Math.min(brand.text ?? 0, colors.length - 1),
  };
}

/** Presets genéricos para una paleta sin definición (la de la foto). */
export function derivePresets(colors: RGB[]): Record<PresetName, number[]> {
  const idx = colors.map((_, i) => i);
  const byLuma = [...idx].sort((a, b) => luma(colors[a]) - luma(colors[b]));
  const darkest = byLuma[0];
  const lightest = byLuma[byLuma.length - 1];
  const bySat = [...idx].sort((a, b) => hueSat(colors[b]).s - hueSat(colors[a]).s);
  const uniq = (xs: number[]) => [...new Set(xs)];
  const warm = idx.filter((i) => {
    const { h, s } = hueSat(colors[i]);
    return s > 0.15 && (h < 70 || h > 300);
  });
  const cool = idx.filter((i) => {
    const { h, s } = hueSat(colors[i]);
    return s > 0.15 && h >= 140 && h <= 300;
  });
  return {
    Full: idx,
    Primary: uniq([darkest, lightest, ...bySat.slice(0, 3)]),
    Duo: uniq([darkest, bySat[0] === darkest ? lightest : bySat[0]]),
    Warm: uniq([darkest, lightest, ...warm]),
    Cool: uniq([darkest, lightest, ...cool]),
  };
}

/**
 * Paleta de la foto: k-means en RGB sobre muestras ya reducidas.
 * Devuelve hasta `k` colores ordenados de claro a oscuro.
 */
export function extractPalette(samples: Float32Array, k = 8): RGB[] {
  const n = samples.length / 3;
  if (n === 0) return brandPalette().colors;
  // Semillas: k-means++ determinístico (el más lejano cada vez).
  const centers: number[][] = [[samples[0], samples[1], samples[2]]];
  const dist = new Float32Array(n).fill(Infinity);
  while (centers.length < k) {
    const c = centers[centers.length - 1];
    let best = 0;
    let bestD = -1;
    for (let i = 0; i < n; i++) {
      const dr = samples[i * 3] - c[0];
      const dg = samples[i * 3 + 1] - c[1];
      const db = samples[i * 3 + 2] - c[2];
      dist[i] = Math.min(dist[i], dr * dr + dg * dg + db * db);
      if (dist[i] > bestD) {
        bestD = dist[i];
        best = i;
      }
    }
    if (bestD <= 1e-6) break;
    centers.push([samples[best * 3], samples[best * 3 + 1], samples[best * 3 + 2]]);
  }
  const assign = new Int32Array(n);
  for (let iter = 0; iter < 12; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let j = 0; j < centers.length; j++) {
        const c = centers[j];
        const dr = samples[i * 3] - c[0];
        const dg = samples[i * 3 + 1] - c[1];
        const db = samples[i * 3 + 2] - c[2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      assign[i] = best;
      const s = sums[best];
      s[0] += samples[i * 3];
      s[1] += samples[i * 3 + 1];
      s[2] += samples[i * 3 + 2];
      s[3]++;
    }
    centers.forEach((c, j) => {
      const s = sums[j];
      if (s[3] > 0) {
        c[0] = s[0] / s[3];
        c[1] = s[1] / s[3];
        c[2] = s[2] / s[3];
      }
    });
  }
  return centers.map((c) => [c[0], c[1], c[2]] as RGB).sort((a, b) => luma(b) - luma(a));
}

export function photoPalette(colors: RGB[]): Palette {
  const lightest = colors.reduce((a, c) => (luma(c) > luma(a) ? c : a), colors[0]);
  const darkestIdx = colors.reduce((ai, c, i) => (luma(c) < luma(colors[ai]) ? i : ai), 0);
  return {
    colors,
    names: colors.map(rgbToHex),
    presets: derivePresets(colors),
    paper: lightest,
    text: darkestIdx,
  };
}

// --- OKLab, para elegir el color más cercano de forma perceptual (mismo cálculo que el shader).
function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function rgbToOklab([r, g, b]: RGB): RGB {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
