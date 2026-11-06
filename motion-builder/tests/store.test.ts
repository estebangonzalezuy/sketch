import { describe, expect, it } from 'vitest';
import { evaluateTrack } from '../src/core/evaluate';
import type { ParamTrack } from '../src/core/project';
import type { ParamSpec, ToolDefinition } from '../src/core/tool';
import { makeLayer, makeProject } from '../src/demo';
import { addLayer, applyAnimation, CENTER_TRACK, moveAllKeys, moveClip, moveKey, moveLayer, moveLayerTo, projectFont, projectFontOptions, removeKey, removeLayer, setKeyEase, setLayerTrack, setParam, setProjectFont, splitClip, toggleKey, toggleParamKey, trimEnd, trimStart, writeTrack, ZOOM_TRACK } from '../src/editor/ops';
import { EditorStore } from '../src/editor/store';

const num: ParamSpec = { kind: 'number', default: 5, min: 0, max: 10, animate: 'frame' };
const LINEAR: [number, number, number, number] = [0, 0, 1, 1];
const project = () => makeProject([makeLayer('a', 'text'), makeLayer('b', 'text')]);
const size = (s: EditorStore) => s.getState().project.layers[0].params.size;

describe('undo y redo', () => {
  it('deshace y rehace cada cambio', () => {
    const s = new EditorStore(project());
    s.edit((p) => setParam(p, 'a', 'size', 10, 0));
    s.edit((p) => setParam(p, 'a', 'size', 20, 0));
    s.undo();
    expect(size(s)).toEqual({ value: 10 });
    s.undo();
    expect(size(s)).toBeUndefined();
    s.undo(); // sin historia no pasa nada
    s.redo();
    s.redo();
    expect(size(s)).toEqual({ value: 20 });
  });

  it('un arrastre es un solo paso, y termina con el gesto', () => {
    const s = new EditorStore(project());
    for (const v of [1, 2, 3]) s.edit((p) => setParam(p, 'a', 'size', v, 0), 'a.size');
    s.endGesture();
    s.edit((p) => setParam(p, 'a', 'size', 4, 0), 'a.size');
    expect(s.getState().past).toHaveLength(2);
    s.undo();
    expect(size(s)).toEqual({ value: 3 });
    s.undo();
    expect(size(s)).toBeUndefined();
  });

  it('un cambio nuevo borra lo rehacible', () => {
    const s = new EditorStore(project());
    s.edit((p) => setParam(p, 'a', 'size', 1, 0));
    s.undo();
    s.edit((p) => setParam(p, 'a', 'size', 2, 0));
    expect(s.getState().future).toHaveLength(0);
  });

  it('el frame y la selección no entran en la historia', () => {
    const s = new EditorStore(project());
    s.setFrame(40);
    s.select('b');
    expect(s.getState().past).toHaveLength(0);
    expect(s.getState().frame).toBe(40);
  });

  it('si undo saca la capa seleccionada, la selección sigue siendo válida', () => {
    const s = new EditorStore(project());
    const tool = { id: 't', name: 'T', version: 1 } as ToolDefinition;
    let id = '';
    s.edit((p) => {
      const r = addLayer(p, tool);
      id = r.id;
      return r.project;
    });
    s.select(id);
    s.undo();
    expect(s.getState().selectedLayerId).toBe('a');
  });
});

describe('operaciones', () => {
  it('editar con keys escribe en el frame, sin perder los demás', () => {
    const track = { keys: [{ frame: 0, value: 0, ease: LINEAR }, { frame: 10, value: 10, ease: 'hold' as const }] };
    const next = writeTrack(track, 7, 5);
    expect('keys' in next && next.keys.map((k) => [k.frame, k.value])).toEqual([[0, 0], [5, 7], [10, 10]]);
    expect(evaluateTrack(next, num, 5)).toBe(7);
  });

  it('un cambio devuelve objetos nuevos en lo que tocó', () => {
    const p = project();
    const next = setParam(p, 'a', 'size', 1, 0);
    expect(next.layers[0]).not.toBe(p.layers[0]);
    expect(next.layers[1]).toBe(p.layers[1]);
  });

  it('el botón de key alterna, y sin keys vuelve a valor fijo', () => {
    const on = toggleKey({ value: 3 }, num, 12);
    expect(on).toEqual({ keys: [{ frame: 12, value: 3, ease: LINEAR }] });
    expect(toggleKey(on, num, 12)).toEqual({ value: 3 });
    expect(toggleKey(undefined, num, 0)).toEqual({ keys: [{ frame: 0, value: 5, ease: LINEAR }] });
  });

  it('agrega arriba, con id libre y sin parámetros propios', () => {
    const tool = { id: 'x', name: 'X', version: 2 } as ToolDefinition;
    const r = addLayer(makeProject([makeLayer('layer-4', 'text')]), tool);
    expect(r.id).toBe('layer-5');
    expect(r.project.layers[0]).toMatchObject({ toolId: 'x', toolVersion: 2, params: {} });
  });

  it('mover respeta los extremos', () => {
    const p = project();
    expect(moveLayer(p, 'a', -1)).toBe(p);
    expect(moveLayer(p, 'a', 1).layers.map((l) => l.id)).toEqual(['b', 'a']);
  });

  it('borrar una capa vacía las entradas que la usaban', () => {
    const p = makeProject([makeLayer('a', 'tag-shader', { inputs: { source: { layerId: 'b' } } }), makeLayer('b', 'text')]);
    expect(removeLayer(p, 'b').layers[0].inputs.source).toBeNull();
  });
});

describe('fuente del proyecto', () => {
  const select = (d: string, options: string[]): ParamSpec => ({ kind: 'select', default: d, options, animate: 'none' });
  const tools = [
    { id: 'a', params: { family: select('X', ['X', 'Y']), labelFamily: select('X', ['X', 'Y']) } },
    { id: 'b', params: { family: select('Y', ['Y']) } },
    { id: 'c', params: {} },
  ] as unknown as ToolDefinition[];

  it('la cambia en todas las capas que la ofrecen', () => {
    const p = makeProject([makeLayer('1', 'a'), makeLayer('2', 'b'), makeLayer('3', 'c')]);
    expect(projectFont(p, tools)).toBeNull();
    const next = setProjectFont(p, tools, 'X');
    expect(next.layers[0].params).toEqual({ family: { value: 'X' }, labelFamily: { value: 'X' } });
    expect(next.layers[1]).toBe(p.layers[1]); // no la ofrece
    expect(projectFont(setProjectFont(p, tools, 'Y'), tools)).toBe('Y');
  });

  it('lista las fuentes disponibles', () => {
    expect(projectFontOptions(tools)).toEqual(['X', 'Y']);
  });
});

describe('clips y keyframes', () => {
  const keys = { keys: [{ frame: 0, value: 0, ease: LINEAR }, { frame: 10, value: 10, ease: LINEAR }, { frame: 20, value: 20, ease: 'hold' as const }] };
  const frames = (t: ParamTrack) => ('keys' in t ? t.keys.map((k) => k.frame) : []);
  const animated = () => makeProject([makeLayer('a', 'text', { start: 10, durationFrames: 30, params: { size: keys } })]);
  const specs = { size: num };

  it('mover un clip no toca sus keys', () => {
    const [l] = moveClip(animated(), 'a', 50).layers;
    expect(l.start).toBe(50);
    expect(l.params.size).toBe(keys);
    expect(moveClip(animated(), 'a', -5).layers[0].start).toBe(0);
  });

  it('recortar el final solo cambia la duración, con mínimo de un frame', () => {
    expect(trimEnd(animated(), 'a', 25).layers[0]).toMatchObject({ start: 10, durationFrames: 15 });
    expect(trimEnd(animated(), 'a', 3).layers[0].durationFrames).toBe(1);
  });

  it('recortar el inicio avanza el offset y no toca los keys', () => {
    const [l] = trimStart(animated(), 'a', 15).layers;
    expect(l).toMatchObject({ start: 15, durationFrames: 25, offset: 5 });
    expect(l.params.size).toBe(keys);
  });

  it('alargar el inicio recupera lo recortado, y después corre los keys', () => {
    const trimmed = trimStart(animated(), 'a', 15);
    expect(trimStart(trimmed, 'a', 10).layers[0]).toMatchObject({ start: 10, durationFrames: 30, offset: 0 });
    const [l] = trimStart(animated(), 'a', 4).layers;
    expect(l).toMatchObject({ start: 4, durationFrames: 36, offset: 0 });
    expect(frames(l.params.size)).toEqual([6, 16, 26]);
  });

  it('cortar deja dos clips que siguen en el mismo tiempo interno', () => {
    const cut = splitClip(animated(), 'a', 25);
    expect(cut.project.layers.map((l) => [l.start, l.durationFrames, l.offset])).toEqual([[10, 15, 0], [25, 15, 15]]);
    expect(cut.project.layers[1].params.size).toBe(keys);
  });

  it('no corta en los bordes ni fuera del clip', () => {
    for (const f of [10, 40, 5, 90]) expect(splitClip(animated(), 'a', f).id).toBeNull();
  });

  it('una capa que usa el clip como entrada se corta con él', () => {
    const p = makeProject([makeLayer('efecto', 'ascii', { inputs: { source: { layerId: 'fuente' } } }), makeLayer('fuente', 'text', { visible: false }), makeLayer('tarde', 'ascii', { start: 200, durationFrames: 50, inputs: { source: { layerId: 'fuente' } } })]);
    const { project, id } = splitClip(p, 'fuente', 100);
    const by = (i: string) => project.layers.find((l) => l.id === i)!;
    expect(by('efecto').durationFrames).toBe(100);
    expect(by('efecto').inputs.source).toEqual({ layerId: 'fuente' });
    expect(project.layers.find((l) => l.toolId === 'ascii' && l.start === 100)?.inputs.source).toEqual({ layerId: id });
    expect(by('tarde').inputs.source).toEqual({ layerId: id });
  });

  it('las pistas de capa se editan y se mueven como las demás', () => {
    const p = makeProject([makeLayer('a', 'text', { zoom: { keys: [{ frame: 5, value: 1, ease: LINEAR }, { frame: 15, value: 2, ease: LINEAR }] } })]);
    expect(frames(moveAllKeys(p, 'a', 10).layers[0].zoom)).toEqual([15, 25]);
    expect(frames(setLayerTrack(p, 'a', ZOOM_TRACK, 3, 10).layers[0].zoom)).toEqual([5, 10, 15]);
    expect(setLayerTrack(p, 'a', ZOOM_TRACK, 3, 900).layers[0].zoom).toBe(p.layers[0].zoom);
    expect(setLayerTrack(p, 'a', CENTER_TRACK, [0.2, 0.3], 0).layers[0].center).toEqual({ value: [0.2, 0.3] });
    expect(trimStart(trimStart(p, 'a', 8), 'a', 0).layers[0].offset).toBe(0);
  });

  it('mover todos los keys respeta el frame 0', () => {
    const p = makeProject([makeLayer('a', 'text', { opacity: { keys: [{ frame: 5, value: 0, ease: LINEAR }] }, params: { size: keys } })]);
    const [l] = moveAllKeys(p, 'a', 10).layers;
    expect(frames(l.params.size)).toEqual([10, 20, 30]);
    expect(frames(l.opacity)).toEqual([15]);
    expect(frames(moveAllKeys(p, 'a', -50).layers[0].params.size)).toEqual([0, 10, 20]);
  });

  it('con el playhead fuera del clip no escribe keys en un borde', () => {
    const p = animated();
    expect(frames(setParam(p, 'a', 'size', 9, 300).layers[0].params.size)).toEqual([0, 10, 20]);
    expect(toggleParamKey(p, 'a', 'size', num, 300)).toBe(p);
    expect(setParam(p, 'a', 'tracking', 9, 300).layers[0].params.tracking).toEqual({ value: 9 }); // un valor fijo no depende del frame
  });

  it('un template arranca en el playhead y termina con el clip', () => {
    const template = { tracks: { size: [[0, 1], [1, 2]] as [number, number][] } };
    const at = (f: number) => frames(applyAnimation(animated(), 'a', template, specs, f).layers[0].params.size);
    expect(at(20)).toEqual([10, 29]);
    expect(at(0)).toEqual([0, 29]); // fuera del clip: lo ocupa entero
    expect(at(35)).toEqual([0, 29]); // sobre el final, también
  });

  it('mover un key conserva su curva, y reemplaza al que pisa', () => {
    expect(moveKey(keys, 20, 5)).toEqual({ keys: [{ frame: 0, value: 0, ease: LINEAR }, { frame: 5, value: 20, ease: 'hold' }, { frame: 10, value: 10, ease: LINEAR }] });
    expect(frames(moveKey(keys, 20, 10))).toEqual([0, 10]);
  });

  it('borrar el último key deja la pista fija', () => {
    expect(frames(removeKey(keys, 10))).toEqual([0, 20]);
    expect(removeKey({ keys: [{ frame: 3, value: 7, ease: LINEAR }] }, 3)).toEqual({ value: 7 });
  });

  it('cambia la curva de un solo key', () => {
    const t = setKeyEase(keys, 10, 'hold');
    expect('keys' in t && t.keys.map((k) => k.ease)).toEqual([LINEAR, 'hold', 'hold']);
  });

  it('mover a un índice respeta los extremos', () => {
    const p = makeProject([makeLayer('a', 'text'), makeLayer('b', 'text'), makeLayer('c', 'text')]);
    expect(moveLayerTo(p, 'a', 9).layers.map((l) => l.id)).toEqual(['b', 'c', 'a']);
    expect(moveLayerTo(p, 'c', 1).layers.map((l) => l.id)).toEqual(['a', 'c', 'b']);
    expect(moveLayerTo(p, 'b', 1)).toBe(p);
  });

  it('acortar el proyecto recorta el frame, y load limpia la historia', () => {
    const s = new EditorStore(animated());
    s.setFrame(200);
    s.edit((p) => ({ ...p, durationFrames: 50 }));
    expect(s.getState().frame).toBe(49);
    s.undo();
    s.load(animated());
    expect(s.getState()).toMatchObject({ frame: 0, past: [], future: [] });
  });
});
