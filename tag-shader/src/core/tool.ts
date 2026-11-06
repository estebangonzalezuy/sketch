import type * as THREE from 'three';

/** frame: barato, se evalúa cada frame · rebuild: animable, pero reconstruye recursos · none: fijo */
export type Animate = 'frame' | 'rebuild' | 'none';

type Base = { label?: string; group?: string; animate: Animate };

export type ParamSpec =
  | (Base & {
      kind: 'number';
      default: number;
      min: number;
      max: number;
      step?: number;
      interp?: 'linear' | 'log'; // log para zoom
      integrated?: boolean; // su efecto depende del historial, como una velocidad
    })
  | (Base & { kind: 'color'; default: string }) // se interpola en OKLab
  | (Base & { kind: 'vec2'; default: [number, number]; min: number; max: number })
  | (Base & { kind: 'boolean'; default: boolean }) // hold
  | (Base & { kind: 'select'; default: string; options: readonly string[] }) // hold
  | (Base & { kind: 'text'; default: string; multiline?: boolean }); // hold

export type ParamValue = number | string | boolean | [number, number];
export type Params = Record<string, ParamValue>;
export type ParamSpecs = Record<string, ParamSpec>;

/** Tramo de un template: posición de 0 a 1 en el clip, valor y curva de salida. */
export type AnimationKey = [at: number, value: ParamValue, ease?: EaseName];
export type EaseName = 'linear' | 'in' | 'out' | 'inOut' | 'expo' | 'back' | 'hold';

/** Template de animación: keyframes reales que quedan editables en el timeline. */
export type AnimationTemplate = {
  values?: Params; // valores fijos que acompañan a la animación
  tracks?: Record<string, AnimationKey[]>;
  opacity?: AnimationKey[];
  zoom?: AnimationKey[];
  center?: AnimationKey[];
};

export type InputSpec = { id: string; label: string; required: boolean };

export type RenderContext = {
  renderer: THREE.WebGLRenderer; // compartido: dejá su estado como lo encontraste
  target: THREE.WebGLRenderTarget; // dibujá acá en premultiplied alpha
  width: number;
  height: number;
  aspect: number; // ancho / alto del proyecto: exacto aunque width y height estén redondeados por la escala
  unit: number; // Math.min(width, height) / 1080: toda medida en px se multiplica por unit
  frame: number; // frame local del clip, entero
  fps: number;
  time: number; // frame / fps
  durationFrames: number;
  seed: number; // nunca Math.random, Date.now ni performance.now
  loop: { phase: number; frames: number } | null;
  inputs: Record<string, THREE.Texture | null>;
  integral: (paramId: string) => number; // integral en segundos desde el inicio del clip
  blit: (texture: THREE.Texture) => void; // copia una textura premultiplied al target
};

export interface ToolInstance {
  /** Carga fuentes o reconstruye recursos. El export siempre lo espera. */
  prepare?(params: Params, ctx: RenderContext): Promise<void>;
  /** Síncrono y determinista: igual entrada, iguales píxeles, sin importar el orden. */
  render(params: Params, ctx: RenderContext): void;
  dispose(): void;
}

export interface ToolDefinition {
  id: string;
  name: string;
  version: number;
  kind: 'generator' | 'effect' | 'hybrid';
  inputs: readonly InputSpec[];
  params: ParamSpecs;
  presets?: Record<string, Params>; // valores de parámetros, sin keyframes
  animations?: Record<string, AnimationTemplate>;
  create(): ToolInstance;
}

export const defineTool = <T extends ToolDefinition>(tool: T) => tool;
