/** Aesthetic tokens shared by every styleframe tool. Two colours per piece, never more. */

export const FONT_FAMILY = 'Archivo Narrow';
export const FONT_WEIGHTS = [400, 500, 600, 700] as const;
export type FontWeight = (typeof FONT_WEIGHTS)[number];

export const fontUrl = (weight: FontWeight, ext: 'woff' | 'woff2') =>
  `/fonts/archivo-narrow-latin-${weight}-normal.${ext}`;

export const TMSC = {
  indigo: '#3D3DEB',
  periwinkle: '#ADB4F5',
  yellow: '#F4C500',
  orange: '#EE4B2B',
  green: '#2E7D46',
  black: '#000000',
  white: '#FFFFFF',
} as const;
export type TmscColor = keyof typeof TMSC;

export type PresetId = 'blue' | 'red' | 'white' | 'tmsc';
export type PaletteState = { preset: PresetId; bg: TmscColor; fg: TmscColor };
export type Palette = { bg: string; fg: string };

export const PRESETS: { id: PresetId; label: string; bg: string; fg: string }[] = [
  { id: 'white', label: 'White / Blue', bg: '#FFFFFF', fg: '#0000FF' },
  { id: 'blue', label: 'Blue / White', bg: '#0000FF', fg: '#FFFFFF' },
  { id: 'red', label: 'Red / Black', bg: '#FF0000', fg: '#000000' },
  { id: 'tmsc', label: 'tMSC', bg: TMSC.indigo, fg: TMSC.white },
];

export function resolvePalette(p: PaletteState): Palette {
  if (p.preset === 'tmsc') return { bg: TMSC[p.bg], fg: TMSC[p.fg] };
  const preset = PRESETS.find((x) => x.id === p.preset)!;
  return { bg: preset.bg, fg: preset.fg };
}

export type FormatId = '1:1' | '16:9';
export const FORMATS: Record<FormatId, { w: number; h: number }> = {
  '1:1': { w: 1080, h: 1080 },
  '16:9': { w: 1920, h: 1080 },
};

/** Default bold-headline look: medium bitmap, cell 6 at 1080 px. */
export const DEFAULT_CELL = 6;

/** Small UI-ish captions inside the frame (labels, coordinates, dimensions), in px at 1080 high. */
export const CAPTION = { size: 19, weight: 500 as FontWeight, tracking: 0.2 };

export const captionFont = (u: number, size = CAPTION.size, weight: number = CAPTION.weight) =>
  `${weight} ${Math.round(size * u * 100) / 100}px "${FONT_FAMILY}"`;
