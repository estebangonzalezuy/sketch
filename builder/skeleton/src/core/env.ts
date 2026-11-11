// Contrato Env del builder = ENV-INTERFACE.md + agregados opcionales (prompt §5.2).
// Sin compilar todavía: revisar en la fase 2.
import type { DialConfig } from "dialkit";

export interface Palette { name: string; bg: string; fg: string }

export interface EnvContext {
  width: number; height: number; dpr: number;
  palette: Palette;
  fonts: { family: "Archivo Narrow" };
  assets: Record<string, unknown>;
  rng: () => number;          // PRNG con semilla (mulberry32). Nunca Math.random en render/step.
  seed: number;
}

export type FrameTarget =
  | { kind: "canvas2d"; ctx: CanvasRenderingContext2D }
  | { kind: "webgl2"; ctx: WebGL2RenderingContext; overlay: CanvasRenderingContext2D };

export type EnvInput = "mic" | "audioFile" | "video" | "tracksJson" | "text" | "pointer" | "midiOut" | "audioOut";

export interface Env<P = Record<string, any>> {
  id: string; title: string; version: string;
  num?: string; category?: string; source?: string;
  params: DialConfig;
  presets: { name: string; params: Partial<P> }[];
  timeline: (p: P) => { duration: number; loop: "cut" | "seamless" | "hold"; fps: 30 };
  inputs?: EnvInput[];
  target?: "canvas2d" | "webgl2";
  load?: (ctx: EnvContext) => Promise<void>;
  init: (target: FrameTarget, ctx: EnvContext, p: P) => void;
  update: (p: P, changed: (keyof P)[]) => void;
  reset?: (seed: number, p: P) => void;           // simulaciones
  step?: (dt: number, p: P) => void;              // simulaciones, dt exacto
  render: (target: FrameTarget, t: number, p: P, ctx: EnvContext) => void;
  random?: (seed: number, p: P) => Partial<P>;
  actions?: Record<string, (p: P) => void | Promise<void>>;
  onPointer?: (e: { x: number; y: number; type: "down" | "move" | "up" }, p: P) => void;
  exports?: { svg?: (p: P, ctx: EnvContext) => string; data?: (p: P) => Blob };
  dispose?: () => void;
}

export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
