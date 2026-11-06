import type { ComponentType } from 'react';
import type { Phase, Timeline } from './timeline';
import type { FormatId, Palette, PaletteState } from './tokens';

/** Settings every tool shares: format, colours, bitmap look, label and frame rate. */
export type Common = {
  format: FormatId;
  palette: PaletteState;
  /** The bold-headline bitmap look (on by default, cell 6 at 1080 px). */
  pixel: boolean;
  cell: number;
  label: string;
  fps: number;
};

export type Frame = {
  t: number;
  w: number;
  h: number;
  /** Scale factor: 1 at 1080 px frame height. Design every size as `n * u`. */
  u: number;
  tl: Timeline;
  pal: Palette;
  common: Common;
};

export type ControlsProps<P> = {
  params: P;
  set: (patch: Partial<P>) => void;
  common: Common;
};

/**
 * A styleframe tool is pure data + a pure render function of time. The shell owns playback,
 * the timeline, easing editors, palette, format and export; a tool only describes a piece.
 */
export type StyleframeTool<P, A> = {
  id: string;
  name: string;
  number: string;
  blurb: string;
  defaults: P;
  phases: Phase[];
  common?: Partial<Common>;
  /** Async assets (outlines, fonts). Re-run whenever `assetsKey` changes. */
  load: (params: P, common: Common) => Promise<A>;
  assetsKey: (params: P, common: Common) => string;
  render: (ctx: CanvasRenderingContext2D, f: Frame, params: P, assets: A) => void;
  Controls: ComponentType<ControlsProps<P>>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTool = StyleframeTool<any, any>;
