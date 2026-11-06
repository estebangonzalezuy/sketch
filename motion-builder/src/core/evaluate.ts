import { applyEase } from './easing';
import { mixOklab } from './color';
import { integralAt } from './integral';
import type { Layer, ParamTrack, Project } from './project';
import type { ParamSpec, ParamSpecs, Params, ParamValue } from './tool';

/** Specs de cada tool por id. Se pasan desde afuera: core no importa las tools, que dependen de three. */
export type ToolSpecs = Record<string, ParamSpecs>;

export type EvaluatedLayer = {
  layer: Layer;
  frame: number; // frame local del clip
  params: Params;
  opacity: number;
  zoom: number;
  center: [number, number];
  loop: { phase: number; frames: number } | null;
};

export const OPACITY_SPEC: ParamSpec = { kind: 'number', default: 1, min: 0, max: 1, step: 0.01, animate: 'frame' };
export const ZOOM_SPEC: ParamSpec = { kind: 'number', default: 1, min: 0.1, max: 20, step: 0.01, interp: 'log', animate: 'frame' };
export const CENTER_SPEC: ParamSpec = { kind: 'vec2', default: [0.5, 0.5], min: 0, max: 1, animate: 'frame' };

function interpolate(spec: ParamSpec, a: ParamValue, b: ParamValue, t: number): ParamValue {
  switch (spec.kind) {
    case 'number': {
      const [x, y] = [a as number, b as number];
      if (spec.interp === 'log' && x > 0 && y > 0) return Math.exp(Math.log(x) + (Math.log(y) - Math.log(x)) * t);
      return x + (y - x) * t;
    }
    case 'vec2': {
      const [x, y] = [a as [number, number], b as [number, number]];
      return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t];
    }
    case 'color':
      return mixOklab(a as string, b as string, t);
    default:
      return a; // boolean, select y text siempre van en hold
  }
}

/** Valor de una pista en un frame local. Antes del primer key y después del último, el valor se sostiene. */
export function evaluateTrack(track: ParamTrack, spec: ParamSpec, frame: number): ParamValue {
  if ('value' in track) return track.value;
  const keys = track.keys;
  if (frame <= keys[0].frame) return keys[0].value;
  const last = keys[keys.length - 1];
  if (frame >= last.frame) return last.value;
  let i = 0;
  while (keys[i + 1].frame <= frame) i++;
  const [a, b] = [keys[i], keys[i + 1]];
  if (a.ease === 'hold') return a.value;
  return interpolate(spec, a.value, b.value, applyEase(a.ease, (frame - a.frame) / (b.frame - a.frame)));
}

export const isActive = (layer: Layer, frame: number) => frame >= layer.start && frame < layer.start + layer.durationFrames;

/** En un loop, cada repetición vuelve a recorrer los keys desde el inicio del clip. */
export const trackFrame = (layer: Layer, frame: number) => (layer.loopFrames ? frame % layer.loopFrames : frame);

/** Parámetros de una capa en un frame de sus pistas, con el default donde no hay pista. */
export function resolveParams(layer: Layer, specs: ParamSpecs, at: number): Params {
  const params: Params = {};
  for (const [id, spec] of Object.entries(specs)) {
    const track = layer.params[id];
    params[id] = track ? evaluateTrack(track, spec, at) : spec.default;
  }
  return params;
}

export const evaluateOpacity = (layer: Layer, at: number) => evaluateTrack(layer.opacity, OPACITY_SPEC, at) as number;

/** Parámetros y opacidad de cada capa activa en un frame del proyecto. Pura: sin three, DOM ni estado. */
export function evaluate(project: Project, frame: number, tools: ToolSpecs): EvaluatedLayer[] {
  const out: EvaluatedLayer[] = [];
  for (const layer of project.layers) {
    if (!isActive(layer, frame)) continue;
    const specs = tools[layer.toolId];
    if (!specs) throw new Error(`La capa "${layer.name}" usa una tool desconocida: ${layer.toolId}`);
    const local = frame - layer.start + layer.offset;
    const at = trackFrame(layer, local);
    out.push({
      layer,
      frame: local,
      params: resolveParams(layer, specs, at),
      opacity: evaluateOpacity(layer, at),
      zoom: evaluateTrack(layer.zoom, ZOOM_SPEC, at) as number,
      center: evaluateTrack(layer.center, CENTER_SPEC, at) as [number, number],
      loop: layer.loopFrames ? { phase: at / layer.loopFrames, frames: layer.loopFrames } : null,
    });
  }
  return out;
}

/** Integral de un parámetro hasta un frame local de la capa. Ver core/integral.ts. */
export function layerIntegral(layer: Layer, specs: ParamSpecs, paramId: string, frame: number, fps: number) {
  const spec = specs[paramId];
  if (!spec || spec.kind !== 'number') throw new Error(`"${paramId}" no es un parámetro numérico`);
  const track = layer.params[paramId] ?? { value: spec.default };
  return integralAt(track, spec, frame, fps, layer.offset + layer.durationFrames, layer.loopFrames);
}
