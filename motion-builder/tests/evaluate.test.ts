import { describe, expect, it } from 'vitest';
import { evaluate, evaluateTrack, layerIntegral, type ToolSpecs } from '../src/core/evaluate';
import { integralAt } from '../src/core/integral';
import { bezier } from '../src/core/easing';
import { mixOklab } from '../src/core/color';
import { parseProject, type Layer, type Project } from '../src/core/project';
import type { ParamSpec } from '../src/core/tool';

const num: ParamSpec = { kind: 'number', default: 0, min: -100, max: 100, animate: 'frame' };
const LINEAR: [number, number, number, number] = [0, 0, 1, 1];

const specs: ToolSpecs = {
  t: {
    a: { kind: 'number', default: 5, min: 0, max: 10, animate: 'frame' },
    zoom: { kind: 'number', default: 1, min: 1, max: 24, interp: 'log', animate: 'frame' },
    c: { kind: 'color', default: '#000000', animate: 'frame' },
    v: { kind: 'vec2', default: [0, 0], min: 0, max: 1, animate: 'frame' },
    on: { kind: 'boolean', default: false, animate: 'frame' },
    mode: { kind: 'select', default: 'x', options: ['x', 'y'], animate: 'frame' },
  },
};

const layer = (over: Partial<Layer> = {}): Layer => ({
  id: 'l',
  name: 'Capa',
  toolId: 't',
  toolVersion: 1,
  start: 10,
  durationFrames: 20,
  offset: 0,
  visible: true,
  blend: 'normal',
  opacity: { value: 1 },
  zoom: { value: 1 },
  center: { value: [0.5, 0.5] },
  seed: 1,
  loopFrames: null,
  inputs: {},
  params: {},
  ...over,
});

const project = (layers: Layer[]): Project => ({
  version: 1,
  name: 'p',
  width: 1920,
  height: 1080,
  fps: 30,
  durationFrames: 100,
  brandTemplateId: null,
  assets: [],
  layers,
});

describe('interpolación', () => {
  it('interpola números con la curva del key de salida', () => {
    const track = { keys: [{ frame: 0, value: 0, ease: LINEAR }, { frame: 10, value: 100, ease: LINEAR }] };
    expect(evaluateTrack(track, num, 5)).toBe(50);
    const eased = { keys: [{ frame: 0, value: 0, ease: [0.42, 0, 1, 1] as typeof LINEAR }, { frame: 10, value: 100, ease: LINEAR }] };
    expect(evaluateTrack(eased, num, 5)).toBeCloseTo(100 * bezier([0.42, 0, 1, 1], 0.5), 6);
    expect(evaluateTrack(eased, num, 5) as number).toBeLessThan(50);
  });

  it('sostiene el valor antes del primer key y después del último', () => {
    const track = { keys: [{ frame: 5, value: 1, ease: LINEAR }, { frame: 10, value: 2, ease: LINEAR }] };
    expect(evaluateTrack(track, num, 0)).toBe(1);
    expect(evaluateTrack(track, num, 5)).toBe(1);
    expect(evaluateTrack(track, num, 10)).toBe(2);
    expect(evaluateTrack(track, num, 99)).toBe(2);
  });

  it('interpola zoom en log', () => {
    const spec = specs.t.zoom;
    const track = { keys: [{ frame: 0, value: 1, ease: LINEAR }, { frame: 10, value: 16, ease: LINEAR }] };
    expect(evaluateTrack(track, spec, 5)).toBeCloseTo(4, 9);
  });

  it('interpola vec2 por componente', () => {
    const track = { keys: [{ frame: 0, value: [0, 1] as [number, number], ease: LINEAR }, { frame: 10, value: [1, 0] as [number, number], ease: LINEAR }] };
    expect(evaluateTrack(track, specs.t.v, 5)).toEqual([0.5, 0.5]);
  });

  it('interpola color en OKLab, no en sRGB', () => {
    expect(mixOklab('#0000FF', '#0000FF', 0.5)).toBe('#0000FF');
    expect(mixOklab('#FF0000', '#00FF00', 0)).toBe('#FF0000');
    expect(mixOklab('#FF0000', '#00FF00', 1)).toBe('#00FF00');
    expect(mixOklab('#000000', '#FFFFFF', 0.5)).toBe('#636363'); // en sRGB sería #808080
  });
});

describe('hold', () => {
  it('una curva hold sostiene hasta el key siguiente', () => {
    const track = { keys: [{ frame: 0, value: 0, ease: 'hold' as const }, { frame: 10, value: 100, ease: LINEAR }] };
    expect(evaluateTrack(track, num, 9)).toBe(0);
    expect(evaluateTrack(track, num, 10)).toBe(100);
  });

  it('boolean y select van en hold aunque el key tenga curva', () => {
    const on = { keys: [{ frame: 0, value: false, ease: LINEAR }, { frame: 10, value: true, ease: LINEAR }] };
    expect(evaluateTrack(on, specs.t.on, 9)).toBe(false);
    expect(evaluateTrack(on, specs.t.on, 10)).toBe(true);
    const mode = { keys: [{ frame: 0, value: 'x', ease: LINEAR }, { frame: 10, value: 'y', ease: LINEAR }] };
    expect(evaluateTrack(mode, specs.t.mode, 9)).toBe('x');
  });
});

describe('integrales', () => {
  const fps = 30;

  it('una constante integra a valor × tiempo', () => {
    expect(integralAt({ value: 2 }, num, 45, fps, 100, null)).toBeCloseTo(3, 9);
  });

  it('una rampa integra al área bajo la curva, no a valor × tiempo', () => {
    const ramp = { keys: [{ frame: 0, value: 0, ease: LINEAR }, { frame: 30, value: 2, ease: LINEAR }] };
    expect(integralAt(ramp, num, 30, fps, 60, null)).toBeCloseTo(1, 9);
    expect(integralAt(ramp, num, 60, fps, 60, null)).toBeCloseTo(3, 9); // 1 + 2 × 1 s
  });

  it('no depende del orden en que se piden los frames', () => {
    const ramp = { keys: [{ frame: 0, value: 0, ease: LINEAR }, { frame: 30, value: 2, ease: LINEAR }] };
    const direct = integralAt(ramp, num, 20, fps, 60, null);
    const fresh = { keys: ramp.keys.map((k) => ({ ...k })) };
    for (let f = 60; f >= 0; f--) integralAt(fresh, num, f, fps, 60, null);
    expect(integralAt(fresh, num, 20, fps, 60, null)).toBe(direct);
  });

  it('en loop normaliza a un número entero de ciclos y cierra', () => {
    const speed = { value: 0.13 }; // 1,3 ciclos en 10 s → 1
    expect(integralAt(speed, num, 0, fps, 300, 300)).toBe(0);
    expect(integralAt(speed, num, 150, fps, 300, 300)).toBeCloseTo(0.5, 9);
    expect(integralAt(speed, num, 299, fps, 300, 300)).toBeCloseTo(299 / 300, 9);
    expect(integralAt(speed, num, 300, fps, 300, 300)).toBe(0); // la repetición es idéntica
  });

  it('conserva el signo y da al menos un ciclo si hay movimiento', () => {
    expect(integralAt({ value: -0.01 }, num, 150, fps, 300, 300)).toBeCloseTo(-0.5, 9);
    expect(integralAt({ value: 0 }, num, 150, fps, 300, 300)).toBe(0);
  });

  it('layerIntegral usa el default si la capa no tiene pista', () => {
    expect(layerIntegral(layer(), specs.t, 'a', 15, 30)).toBeCloseTo(2.5, 9);
  });
});

describe('límites de clip', () => {
  const p = project([layer()]);

  it('el clip cubre [start, start + duración)', () => {
    expect(evaluate(p, 9, specs)).toHaveLength(0);
    expect(evaluate(p, 10, specs)).toHaveLength(1);
    expect(evaluate(p, 29, specs)).toHaveLength(1);
    expect(evaluate(p, 30, specs)).toHaveLength(0);
  });

  it('entrega el frame local y los keys viajan con el clip', () => {
    const track = { keys: [{ frame: 0, value: 0, ease: LINEAR }, { frame: 10, value: 10, ease: LINEAR }] };
    const moved = project([layer({ start: 40, params: { a: track } })]);
    const [e] = evaluate(moved, 45, specs);
    expect(e.frame).toBe(5);
    expect(e.params.a).toBe(5);
  });

  it('completa con defaults lo que la capa no define', () => {
    const [e] = evaluate(p, 10, specs);
    expect(e.params).toMatchObject({ a: 5, zoom: 1, mode: 'x' });
  });

  it('en loop repite los keys y entrega la fase', () => {
    const track = { keys: [{ frame: 0, value: 0, ease: LINEAR }, { frame: 10, value: 10, ease: LINEAR }] };
    const looped = project([layer({ start: 0, durationFrames: 40, loopFrames: 20, params: { a: track } })]);
    const [e] = evaluate(looped, 25, specs);
    expect(e.frame).toBe(25);
    expect(e.params.a).toBe(5);
    expect(e.loop).toEqual({ phase: 0.25, frames: 20 });
  });

  it('rechaza una tool desconocida', () => {
    expect(() => evaluate(project([layer({ toolId: 'nada' })]), 10, specs)).toThrow(/nada/);
  });
});

describe('schema del proyecto', () => {
  it('acepta un proyecto válido y rechaza uno roto', () => {
    expect(parseProject(project([layer()])).layers).toHaveLength(1);
    expect(() => parseProject({ ...project([]), fps: 'x' })).toThrow();
    expect(() => parseProject({ ...project([]), version: 2 })).toThrow();
  });
});
