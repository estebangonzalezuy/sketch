// Contrato Env del builder = ENV-INTERFACE.md + agregados opcionales (CLAUDE-PROMPT.md §5.2).
// Regla: solo se agregan campos opcionales. Harmonógrafo y Physarum Metro lo siguen.
import type { DialConfig } from "dialkit";

export type DialSchema = DialConfig;

export interface Palette {
  name: string;
  bg: string;
  fg: string;
}

export interface EnvContext {
  width: number;
  height: number;
  dpr: number;
  palette: Palette;
  fonts: { family: "Archivo Narrow" };
  assets: Record<string, unknown>;
  /** agregado del builder: semilla activa */
  seed: number;
  /** agregado del builder: PRNG nuevo con la semilla (y un salt opcional). Nunca Math.random en render/step. */
  prng: (salt?: number) => () => number;
}

export type FrameTarget =
  | { kind: "canvas2d"; ctx: CanvasRenderingContext2D }
  | {
      kind: "webgl2";
      ctx: WebGL2RenderingContext;
      /** capa 2D transparente para texto; el builder la compone encima del GL */
      overlay: CanvasRenderingContext2D;
    };

export type EnvInput = "mic" | "audioFile" | "video" | "tracksJson" | "text" | "pointer" | "midiOut" | "audioOut";

/** Lo que puede devolver una action (opcional): params a escribir en el panel, o volver a t = 0. */
export interface ActionResult<P> {
  params?: Partial<P>;
  reset?: boolean;
}

export interface Timeline {
  duration: number;
  loop: "cut" | "seamless" | "hold";
  fps: 30;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Env<P = any> {
  id: string;
  title: string;
  version: string;
  params: DialSchema;
  presets: { name: string; params: Partial<P> }[];
  timeline: (p: P) => Timeline;
  load?: (ctx: EnvContext) => Promise<void>;
  init: (target: FrameTarget, ctx: EnvContext, p: P) => void;
  update: (p: P, changed: string[]) => void;
  render: (target: FrameTarget, t: number, p: P, ctx: EnvContext) => void;
  random?: (seed: number, p: P) => Partial<P>;
  actions?: Record<string, (p: P, ctx: EnvContext) => void | ActionResult<P> | Promise<void | ActionResult<P>>>;
  exports?: {
    svg?: (p: P, ctx: EnvContext) => string;
    png?: true;
    mp4?: true;
    data?: (p: P) => Blob;
  };
  dispose?: () => void;

  // ── agregados del builder (opcionales) ──
  num?: string;
  category?: string;
  /** contexto que pide el entorno; por defecto canvas2d */
  target?: "canvas2d" | "webgl2";
  inputs?: EnvInput[];
  /** simulaciones: estado 0 con semilla */
  reset?: (seed: number, p: P) => void;
  /** simulaciones: avanza exactamente dt (1/30 s) */
  step?: (dt: number, p: P) => void;
  onPointer?: (e: { x: number; y: number; type: "down" | "move" | "up" }, p: P) => void;
  /** fuente del dato, para el status y el canvas */
  source?: string;
}

export const FPS = 30;
