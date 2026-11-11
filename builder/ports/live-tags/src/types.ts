import type { PaletteId } from "./palettes";

export type ModeId = "trayectorias" | "medidas" | "contador" | "atlas";
export type ViewId = "footage" | "canvas";

export type PathPoint = {
  f: number;
  x: number;
  y: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
};

export type Swatch = { rgb: [number, number, number]; hex: string };

export type Track = {
  id: string | number;
  cls: string;
  label: string;
  bucket: string | null;
  born: number;
  dead: number;
  hits: number;
  score: number;
  path: PathPoint[];
  swatch?: Swatch;
  /** Filled at load time. */
  byFrame?: Map<number, PathPoint>;
};

export type Measure = {
  id: string;
  kind: "distance" | "speed";
  a: string;
  b?: string;
  title: string;
  unit: string;
  appear: number;
  window?: number;
};

export type Project = {
  id: string;
  plate: string;
  width: number;
  height: number;
  fps: number;
  nFrames: number;
  pxPerM?: number;
  tracks: Track[];
  measures?: Measure[];
  swatches?: { id: string; hex: string; rgb: number[] }[];
};

export type Dials = {
  tamaño: number;
  ritmo: number;
  cantidad: number;
};

export type AppState = {
  mode: ModeId;
  view: ViewId;
  palette: PaletteId;
  dials: Dials;
  playing: boolean;
  frame: number;
};

export const MODE_PLATE: Record<ModeId, { tracks: string; title: string }> = {
  trayectorias: { tracks: "nyc", title: "trayectorias" },
  medidas: { tracks: "paris", title: "medidas" },
  contador: { tracks: "nyc", title: "contador" },
  atlas: { tracks: "bcn-balconies", title: "atlas de color" },
};

export const W = 1080;
export const H = 1350;
export const FPS = 30;
