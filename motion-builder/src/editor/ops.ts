import { CENTER_SPEC, evaluateTrack, OPACITY_SPEC, trackFrame, ZOOM_SPEC } from '../core/evaluate';
import type { Keyframe, Layer, ParamTrack, Project } from '../core/project';
import type { EditorStore } from './store';
import type { Ease } from '../core/easing';
import type { AnimationKey, AnimationTemplate, EaseName, ParamSpec, ParamSpecs, ParamValue, ToolDefinition } from '../core/tool';

/** Operaciones puras sobre el proyecto. Devuelven objetos nuevos: la caché de integrales depende de eso. */

const LINEAR: Keyframe['ease'] = [0, 0, 1, 1];

export const updateLayer = (project: Project, id: string, change: (layer: Layer) => Layer): Project => ({
  ...project,
  layers: project.layers.map((l) => (l.id === id ? change(l) : l)),
});

/** Nuevo valor de una pista: reemplaza el fijo, o escribe un key en el frame si la pista está animada. */
export function writeTrack(track: ParamTrack | undefined, value: ParamValue, at: number): ParamTrack {
  if (!track || 'value' in track) return { value };
  const keys = track.keys.filter((k) => k.frame !== at);
  const ease = track.keys.find((k) => k.frame === at)?.ease ?? previousEase(track.keys, at);
  return { keys: [...keys, { frame: at, value, ease }].sort((a, b) => a.frame - b.frame) };
}

const previousEase = (keys: Keyframe[], at: number) => [...keys].reverse().find((k) => k.frame < at)?.ease ?? LINEAR;

export const hasKeyAt = (track: ParamTrack | undefined, at: number) => !!track && 'keys' in track && track.keys.some((k) => k.frame === at);

/** Pone o saca un key en el frame. Sin keys, la pista vuelve a un valor fijo con el valor que mostraba. */
export function toggleKey(track: ParamTrack | undefined, spec: ParamSpec, at: number): ParamTrack {
  const current = track ?? { value: spec.default };
  const value = evaluateTrack(current, spec, at);
  if ('value' in current) return { keys: [{ frame: at, value, ease: LINEAR }] };
  const keys = current.keys.filter((k) => k.frame !== at);
  if (keys.length === current.keys.length) return writeTrack(current, value, at);
  return keys.length ? { keys } : { value };
}

export function setParam(project: Project, layerId: string, paramId: string, value: ParamValue, frame: number): Project {
  return updateLayer(project, layerId, (l) => ({
    ...l,
    params: { ...l.params, [paramId]: canWrite(l, l.params[paramId], frame) ? writeTrack(l.params[paramId], value, localAt(l, frame)) : l.params[paramId] },
  }));
}

export function setOpacity(project: Project, layerId: string, value: number, frame: number): Project {
  return updateLayer(project, layerId, (l) => ({ ...l, opacity: canWrite(l, l.opacity, frame) ? writeTrack(l.opacity, value, localAt(l, frame)) : l.opacity }));
}

export function toggleParamKey(project: Project, layerId: string, paramId: string, spec: ParamSpec, frame: number): Project {
  const layer = project.layers.find((l) => l.id === layerId);
  if (!layer || !insideClip(layer, frame)) return project;
  return updateLayer(project, layerId, (l) => ({
    ...l,
    params: { ...l.params, [paramId]: toggleKey(l.params[paramId], spec, localAt(l, frame)) },
  }));
}

export function toggleOpacityKey(project: Project, layerId: string, frame: number): Project {
  const layer = project.layers.find((l) => l.id === layerId);
  if (!layer || !insideClip(layer, frame)) return project;
  return updateLayer(project, layerId, (l) => ({ ...l, opacity: toggleKey(l.opacity, OPACITY_SPEC, localAt(l, frame)) }));
}

/** Frame de las pistas de una capa para un frame del proyecto, dentro del clip. */
export function localAt(layer: Layer, frame: number) {
  const local = Math.min(Math.max(frame - layer.start, 0), layer.durationFrames - 1) + layer.offset;
  return trackFrame(layer, local);
}

export const insideClip = (layer: Layer, frame: number) => frame >= layer.start && frame < layer.start + layer.durationFrames;

/** Con el playhead fuera del clip no hay frame donde escribir un key: caería en un borde sin que se vea. */
const canWrite = (layer: Layer, track: ParamTrack | undefined, frame: number) => !track || 'value' in track || insideClip(layer, frame);

/** Capa nueva arriba de todo, con el largo del proyecto. Solo define lo que no sale del schema. */
export function addLayer(project: Project, tool: ToolDefinition): { project: Project; id: string } {
  const numbers = project.layers.map((l) => Number(/^layer-(\d+)$/.exec(l.id)?.[1] ?? 0));
  const n = Math.max(0, ...numbers, project.layers.length) + 1;
  const id = `layer-${n}`;
  const layer: Layer = {
    id,
    name: `${tool.name} ${n}`,
    toolId: tool.id,
    toolVersion: tool.version,
    start: 0,
    durationFrames: project.durationFrames,
    offset: 0,
    visible: true,
    blend: 'normal',
    opacity: { value: 1 },
    zoom: { value: 1 },
    center: { value: [0.5, 0.5] },
    seed: n,
    loopFrames: null,
    inputs: {},
    params: {},
  };
  return { project: { ...project, layers: [layer, ...project.layers] }, id };
}

/** Al borrar una capa, las entradas que la usaban quedan vacías. */
export function removeLayer(project: Project, id: string): Project {
  const unlink = (l: Layer): Layer => ({
    ...l,
    inputs: Object.fromEntries(Object.entries(l.inputs).map(([k, v]) => [k, v && 'layerId' in v && v.layerId === id ? null : v])),
  });
  return { ...project, layers: project.layers.filter((l) => l.id !== id).map(unlink) };
}

/** Borra una capa y selecciona la que quedó en su lugar. */
export function deleteLayer(store: Pick<EditorStore, 'edit' | 'select' | 'getState'>, id: string) {
  const index = store.getState().project.layers.findIndex((l) => l.id === id);
  store.edit((project) => removeLayer(project, id));
  const { layers } = store.getState().project;
  store.select(layers[Math.min(index, layers.length - 1)]?.id ?? null);
}

export function moveLayer(project: Project, id: string, delta: number): Project {
  const from = project.layers.findIndex((l) => l.id === id);
  const to = from + delta;
  if (delta === 0 || from < 0 || to < 0 || to >= project.layers.length) return project;
  const layers = [...project.layers];
  layers.splice(to, 0, layers.splice(from, 1)[0]);
  return { ...project, layers };
}

/** Id de la pista de opacidad en el timeline: no es un parámetro de la tool. */
export const OPACITY_TRACK = '$opacity';

export const ZOOM_TRACK = '$zoom';
export const CENTER_TRACK = '$center';

/** Pistas de la capa, que no son parámetros de la tool. */
const LAYER_TRACKS = {
  [OPACITY_TRACK]: { key: 'opacity', spec: OPACITY_SPEC, label: 'opacidad' },
  [ZOOM_TRACK]: { key: 'zoom', spec: ZOOM_SPEC, label: 'zoom' },
  [CENTER_TRACK]: { key: 'center', spec: CENTER_SPEC, label: 'centro' },
} as const;
type LayerTrackId = keyof typeof LAYER_TRACKS;
const layerTrack = (id: string) => LAYER_TRACKS[id as LayerTrackId];

export const LAYER_TRACK_IDS = Object.keys(LAYER_TRACKS);

export const trackOf = (layer: Layer, id: string) => (layerTrack(id) ? layer[layerTrack(id).key] : layer.params[id]);

export const specOf = (specs: ParamSpecs, id: string) => layerTrack(id)?.spec ?? specs[id];

export const trackLabel = (specs: ParamSpecs, id: string) => layerTrack(id)?.label ?? specs[id]?.label ?? id;

export function updateTrack(project: Project, layerId: string, id: string, change: (track: ParamTrack) => ParamTrack): Project {
  return updateLayer(project, layerId, (l) => (layerTrack(id) ? { ...l, [layerTrack(id).key]: change(l[layerTrack(id).key]) } : { ...l, params: { ...l.params, [id]: change(l.params[id]) } }));
}

/** Escribe una pista de la capa: fija, o un key en el frame si está animada. */
export function setLayerTrack(project: Project, layerId: string, id: string, value: ParamValue, frame: number): Project {
  return updateLayer(project, layerId, (l) => {
    const track = trackOf(l, id);
    return canWrite(l, track, frame) ? updateTrack(project, layerId, id, (t) => writeTrack(t, value, localAt(l, frame))).layers.find((x) => x.id === layerId)! : l;
  });
}

export function toggleLayerTrackKey(project: Project, layerId: string, id: string, frame: number): Project {
  const layer = project.layers.find((l) => l.id === layerId);
  if (!layer || !insideClip(layer, frame)) return project;
  return updateTrack(project, layerId, id, (t) => toggleKey(t, specOf({}, id), localAt(layer, frame)));
}

/** Mueve un key. Si cae sobre otro, lo reemplaza. */
export function moveKey(track: ParamTrack, from: number, to: number): ParamTrack {
  if (!('keys' in track)) return track;
  const moved = track.keys.find((k) => k.frame === from);
  if (!moved) return track;
  const rest = track.keys.filter((k) => k.frame !== from && k.frame !== to);
  return { keys: [...rest, { ...moved, frame: to }].sort((a, b) => a.frame - b.frame) };
}

/** Saca un key. El último deja la pista fija en su valor. */
export function removeKey(track: ParamTrack, frame: number): ParamTrack {
  if (!('keys' in track)) return track;
  const keys = track.keys.filter((k) => k.frame !== frame);
  return keys.length ? { keys } : { value: track.keys[0].value };
}

export function setKeyEase(track: ParamTrack, frame: number, ease: Ease): ParamTrack {
  if (!('keys' in track)) return track;
  return { keys: track.keys.map((k) => (k.frame === frame ? { ...k, ease } : k)) };
}

/** Mover un clip no toca sus keys: son relativos a su inicio. */
export function moveClip(project: Project, id: string, start: number): Project {
  return updateLayer(project, id, (l) => ({ ...l, start: Math.max(0, start) }));
}

export function trimEnd(project: Project, id: string, end: number): Project {
  return updateLayer(project, id, (l) => ({ ...l, durationFrames: Math.max(1, end - l.start) }));
}

const shiftTrack = (track: ParamTrack, delta: number): ParamTrack => ('keys' in track ? { keys: track.keys.map((k) => ({ ...k, frame: k.frame + delta })) } : track);

const shiftAll = (l: Layer, delta: number): Layer => ({
  ...l,
  opacity: shiftTrack(l.opacity, delta),
  zoom: shiftTrack(l.zoom, delta),
  center: shiftTrack(l.center, delta),
  params: Object.fromEntries(Object.entries(l.params).map(([k, t]) => [k, shiftTrack(t, delta)])),
});

/**
 * Recorta el inicio del clip. Acortar solo avanza el offset: keys, integrales y movimiento quedan donde estaban.
 * Alargar primero recupera lo recortado; más allá del frame 0 de las pistas, corre los keys.
 */
export function trimStart(project: Project, id: string, start: number): Project {
  return updateLayer(project, id, (l) => {
    const end = l.start + l.durationFrames;
    const next = Math.min(Math.max(0, start), end - 1);
    const offset = l.offset + (next - l.start);
    const clip = { ...l, start: next, durationFrames: end - next, offset: Math.max(0, offset) };
    return offset >= 0 ? clip : shiftAll(clip, -offset);
  });
}

/** Mueve juntos todos los keys de una capa, sin dejar ninguno antes del frame 0 de las pistas. */
export function moveAllKeys(project: Project, id: string, delta: number): Project {
  return updateLayer(project, id, (l) => {
    const tracks = [l.opacity, l.zoom, l.center, ...Object.values(l.params)];
    const first = Math.min(...tracks.flatMap((t) => ('keys' in t ? t.keys.map((k) => k.frame) : [])));
    if (!Number.isFinite(first)) return l;
    return shiftAll(l, Math.max(delta, -first));
  });
}

/**
 * Corta un clip en un frame: la segunda parte pasa a una capa propia, justo debajo, y sigue en el mismo tiempo interno.
 * Las capas que usan el clip como entrada se cortan también, para no quedarse sin fuente después del corte.
 */
export function splitClip(project: Project, id: string, frame: number): { project: Project; id: string | null } {
  const layer = project.layers.find((l) => l.id === id);
  if (!layer || frame <= layer.start || frame >= layer.start + layer.durationFrames) return { project, id: null };

  const numbers = project.layers.map((l) => Number(/^layer-(\d+)$/.exec(l.id)?.[1] ?? 0));
  const newId = `layer-${Math.max(0, ...numbers, project.layers.length) + 1}`;
  const before = frame - layer.start;
  const left: Layer = { ...layer, durationFrames: before };
  const right: Layer = { ...layer, id: newId, name: `${layer.name} · corte`, start: frame, durationFrames: layer.durationFrames - before, offset: layer.offset + before };
  const layers = project.layers.flatMap((l) => (l.id === id ? [left, right] : [l]));
  let next: Project = { ...project, layers };

  for (const consumer of project.layers) {
    const inputs = Object.entries(consumer.inputs).filter(([, v]) => v && 'layerId' in v && v.layerId === id);
    if (inputs.length === 0) continue;
    const rewire = (project: Project, target: string) => inputs.reduce((p, [inputId]) => setInput(p, target, inputId, { layerId: newId }), project);
    if (consumer.start >= frame) {
      next = rewire(next, consumer.id);
    } else if (consumer.start + consumer.durationFrames > frame) {
      const cut = splitClip(next, consumer.id, frame);
      next = cut.id ? rewire(cut.project, cut.id) : next;
    }
  }
  return { project: next, id: newId };
}

export function moveLayerTo(project: Project, id: string, index: number): Project {
  const from = project.layers.findIndex((l) => l.id === id);
  return from < 0 ? project : moveLayer(project, id, Math.min(Math.max(0, index), project.layers.length - 1) - from);
}

export type InputRef = Layer['inputs'][string];

export const setInput = (project: Project, layerId: string, inputId: string, input: InputRef) =>
  updateLayer(project, layerId, (l) => ({ ...l, inputs: { ...l.inputs, [inputId]: input } }));

/** Registra una imagen. La ruta queda relativa al .json: assets/ vive junto al archivo. */
export function addAsset(project: Project, fileName: string): { project: Project; id: string } {
  const n = project.assets.length + 1;
  const id = `asset-${n}`;
  const path = `assets/${id}-${fileName.replace(/[^\w.-]+/g, '_')}`;
  return { project: { ...project, assets: [...project.assets, { id, kind: 'image', path }] }, id };
}

const FONT_PARAMS = ['family', 'labelFamily'];

const fontSpecs = (tool: ToolDefinition) => FONT_PARAMS.flatMap((id) => (tool.params[id]?.kind === 'select' ? [[id, tool.params[id]] as const] : []));

/** Fuentes que se pueden elegir en al menos una tool. */
export const projectFontOptions = (tools: readonly ToolDefinition[]) => [...new Set(tools.flatMap((t) => fontSpecs(t).flatMap(([, s]) => (s.kind === 'select' ? [...s.options] : []))))];

/** Fuente que usan todas las capas, o null si hay más de una. */
export function projectFont(project: Project, tools: readonly ToolDefinition[]) {
  const used = new Set(
    project.layers.flatMap((l) => {
      const tool = tools.find((t) => t.id === l.toolId);
      return tool ? fontSpecs(tool).map(([id, spec]) => evaluateTrack(l.params[id] ?? { value: spec.default }, spec, 0) as string) : [];
    }),
  );
  return used.size === 1 ? [...used][0] : null;
}

/** Pone una fuente en todas las capas. Una tool que no la ofrece conserva la suya. */
export function setProjectFont(project: Project, tools: readonly ToolDefinition[], family: string): Project {
  return {
    ...project,
    layers: project.layers.map((l) => {
      const tool = tools.find((t) => t.id === l.toolId);
      const fonts = tool ? fontSpecs(tool).filter(([, s]) => s.kind === 'select' && s.options.includes(family)) : [];
      return fonts.length ? { ...l, params: { ...l.params, ...Object.fromEntries(fonts.map(([id]) => [id, { value: family }])) } } : l;
    }),
  };
}

/** Aplica valores sin keyframes: en una pista animada escriben un key en el frame. */
export function applyValues(project: Project, layerId: string, values: Record<string, ParamValue>, specs: ParamSpecs, frame: number) {
  return Object.entries(values).reduce((p, [id, value]) => (specs[id] ? setParam(p, layerId, id, value, frame) : p), project);
}

const EASES: Record<EaseName, Ease> = {
  linear: [0, 0, 1, 1],
  in: [0.55, 0, 1, 0.45],
  out: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
  expo: [0.87, 0, 0.13, 1],
  back: [0.34, 1.56, 0.64, 1],
  hold: 'hold',
};

/** Pasa las posiciones de 0 a 1 a frames del clip: el template se adapta a su duración. */
function templateTrack(keys: AnimationKey[], from: number, length: number): ParamTrack {
  const byFrame = new Map(keys.map(([at, value, ease]) => [from + Math.round(at * (length - 1)), { value, ease: EASES[ease ?? 'linear'] }]));
  return { keys: [...byFrame].map(([frame, k]) => ({ frame, ...k })).sort((a, b) => a.frame - b.frame) };
}

const MIN_TEMPLATE_FRAMES = 15;

/**
 * Aplica un template desde el playhead hasta el final del clip. Las pistas que trae reemplazan a las que había.
 * Con el playhead fuera del clip o sobre su final, o en un loop, ocupa el clip entero.
 */
export function applyAnimation(project: Project, layerId: string, template: AnimationTemplate, specs: ParamSpecs, frame = 0): Project {
  return updateLayer(project, layerId, (l) => {
    const end = l.offset + l.durationFrames;
    const local = frame - l.start + l.offset;
    const anchored = !l.loopFrames && insideClip(l, frame) && end - local >= MIN_TEMPLATE_FRAMES;
    const from = anchored ? local : l.offset;
    const length = l.loopFrames ?? end - from;
    const params = { ...l.params };
    for (const [id, value] of Object.entries(template.values ?? {})) if (specs[id]) params[id] = { value };
    for (const [id, keys] of Object.entries(template.tracks ?? {})) if (specs[id]) params[id] = templateTrack(keys, from, length);
    return {
      ...l,
      params,
      opacity: template.opacity ? templateTrack(template.opacity, from, length) : l.opacity,
      zoom: template.zoom ? templateTrack(template.zoom, from, length) : l.zoom,
      center: template.center ? templateTrack(template.center, from, length) : l.center,
    };
  });
}

/** Capa nueva desde un template. Un efecto toma como entrada la capa que quedó debajo. */
export function addLayerFrom(project: Project, tool: ToolDefinition, templateName: string, frame = 0) {
  const below = project.layers[0]?.id;
  const added = addLayer(project, tool);
  const template = tool.animations?.[templateName];
  let next = template ? applyAnimation(added.project, added.id, template, tool.params, frame) : added.project;
  const required = tool.inputs.find((i) => i.required);
  if (required && below) next = setInput(next, added.id, required.id, { layerId: below });
  return { project: next, id: added.id };
}

/** Templates de encuadre: valen para cualquier capa, sea de la tool que sea. */
export const LAYER_ANIMATIONS: Record<string, AnimationTemplate> = {
  'Zoom in': { zoom: [[0, 1, 'inOut'], [1, 2.5]] },
  'Zoom out': { zoom: [[0, 2.5, 'inOut'], [1, 1]] },
  'Zoom lento': { zoom: [[0, 1, 'linear'], [1, 1.2]] },
  'Golpe de zoom': { zoom: [[0, 1.6, 'out'], [0.35, 1]] },
  'Entrada desde lejos': { zoom: [[0, 0.4, 'out'], [0.5, 1]], opacity: [[0, 0, 'out'], [0.2, 1]] },
  'Paneo con zoom': { zoom: [[0, 2, 'inOut'], [1, 2]], center: [[0, [0.3, 0.5], 'inOut'], [1, [0.7, 0.5]]] },
};
