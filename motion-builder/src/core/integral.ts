import { evaluateTrack } from './evaluate';
import type { ParamTrack } from './project';
import type { ParamSpec } from './tool';

/**
 * Integral en segundos de un parámetro desde el inicio del clip, por trapecios entre frames.
 * Se calcula entera de una vez, así el valor en un frame no depende de qué frames se pidieron antes.
 * La caché se indexa por el objeto pista: editar una pista debe producir un objeto nuevo.
 */
const cache = new WeakMap<ParamTrack, Map<string, Float64Array>>();

function prefix(track: ParamTrack, spec: ParamSpec, frames: number, fps: number) {
  let byKey = cache.get(track);
  if (!byKey) cache.set(track, (byKey = new Map()));
  const key = `${frames}/${fps}`;
  let sums = byKey.get(key);
  if (!sums) {
    sums = new Float64Array(frames + 1);
    let prev = evaluateTrack(track, spec, 0) as number;
    for (let f = 1; f <= frames; f++) {
      const next = evaluateTrack(track, spec, f) as number;
      sums[f] = sums[f - 1] + (prev + next) / 2 / fps;
      prev = next;
    }
    byKey.set(key, sums);
  }
  return sums;
}

/**
 * En modo loop la integral se normaliza a un número entero de ciclos, redondeando el total del loop
 * (con mínimo de un ciclo si hay movimiento) y conservando la forma de la curva.
 * Vale 0 al inicio de cada repetición y un entero al final: el loop cierra.
 */
export function integralAt(
  track: ParamTrack,
  spec: ParamSpec,
  frame: number,
  fps: number,
  durationFrames: number,
  loopFrames: number | null,
) {
  if (!loopFrames) return prefix(track, spec, durationFrames, fps)[frame];
  const sums = prefix(track, spec, loopFrames, fps);
  const total = sums[loopFrames];
  if (total === 0) return 0;
  const cycles = Math.round(total) || Math.sign(total);
  return (sums[frame % loopFrames] / total) * cycles;
}
