import type { Layer, Project } from './core/project';
import type { ParamValue } from './core/tool';
import chartPresets from './tools/chart/presets.json';
import tablePresets from './tools/table/presets.json';

const LINEAR: [number, number, number, number] = [0, 0, 1, 1];
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const values = (params: Record<string, ParamValue>) => Object.fromEntries(Object.entries(params).map(([id, value]) => [id, { value }]));

export function makeLayer(id: string, toolId: string, over: Partial<Layer> = {}): Layer {
  return {
    id,
    name: id,
    toolId,
    toolVersion: 1,
    start: 0,
    durationFrames: 300,
    offset: 0,
    visible: true,
    blend: 'normal',
    opacity: { value: 1 },
    zoom: { value: 1 },
    center: { value: [0.5, 0.5] },
    seed: 7,
    loopFrames: null,
    inputs: {},
    params: {},
    ...over,
  };
}

export function makeProject(layers: Layer[], over: Partial<Project> = {}): Project {
  return {
    version: 1,
    name: 'Demo',
    width: 1920,
    height: 1080,
    fps: 30,
    durationFrames: 300,
    brandTemplateId: null,
    environmentId: 'inception',
    assets: [],
    layers,
    ...over,
  };
}

/** Proyecto vacío: 1080p, 30 fps, 10 s. */
export const blankProject = () => makeProject([], { name: 'Sin título' });

/** Texto con revelado animado. */
export const textProject = () =>
  makeProject([
    makeLayer('texto', 'text', {
      seed: 3,
      params: {
        ...values({ text: 'MOTION\nBUILDER', size: 280, lineHeight: 0.95, align: 'center' }),
        reveal: { keys: [{ frame: 10, value: 0, ease: EASE_OUT }, { frame: 180, value: 1, ease: LINEAR }] },
      },
    }),
  ]);

/** Tag Shader animado con keyframes comunes: zoom, mezcla y velocidad. */
export const tagProject = () =>
  makeProject([
    makeLayer('tag', 'tag-shader', {
      params: {
        zoom: { keys: [{ frame: 0, value: 1, ease: [0.65, 0, 0.35, 1] }, { frame: 150, value: 6, ease: LINEAR }] },
        mix: { keys: [{ frame: 90, value: 0, ease: LINEAR }, { frame: 200, value: 1, ease: LINEAR }] },
        speed: { keys: [{ frame: 0, value: 0.05, ease: LINEAR }, { frame: 300, value: 0.4, ease: LINEAR }] },
      },
    }),
  ]);

/** Text Extruder con giro, cámara y material animados. */
export const extruderProject = () =>
  makeProject([
    makeLayer('extruder', 'text-extruder', {
      params: {
        ...values({ text: 'MOTION', weight: 'Bold', anim: 'wave', speed: 0.3, floor: false }),
        rotY: { keys: [{ frame: 0, value: -30, ease: [0.65, 0, 0.35, 1] }, { frame: 240, value: 30, ease: LINEAR }] },
      },
    }),
  ]);

/** Text Extruder como entrada de Tag Shader. */
export const chainProject = () => {
  const [source] = extruderProject().layers;
  return makeProject([makeLayer('mosaico', 'tag-shader', { inputs: { source: { layerId: 'extruder' } } }), { ...source, visible: false }]);
};

/** Text Extruder como entrada de ASCII. */
export const asciiProject = () => {
  const [source] = extruderProject().layers;
  return makeProject([
    makeLayer('ascii', 'ascii', { inputs: { source: { layerId: 'extruder' } }, params: values({ colorMode: 'dark', showPattern: true, fontSize: 12 }) }),
    { ...source, visible: false, params: { ...source.params, ...values({ size: 2 }) } },
  ]);
};

/** Las cuatro tools: Text Extruder alimenta a Tag Shader y a ASCII, con Texto encima. */
export const fourToolsProject = () =>
  makeProject([
    makeLayer('texto', 'text', {
      seed: 3,
      params: {
        ...values({ text: 'MOTION\nBUILDER', size: 200, lineHeight: 0.95, align: 'center', color: '#FF0000' }),
        reveal: { keys: [{ frame: 10, value: 0, ease: EASE_OUT }, { frame: 180, value: 1, ease: LINEAR }] },
      },
    }),
    makeLayer('ascii', 'ascii', { blend: 'screen', inputs: { source: { layerId: 'extruder' } }, params: values({ showPattern: true, fontSize: 12 }) }),
    makeLayer('tag', 'tag-shader', {
      inputs: { source: { layerId: 'extruder' } },
      params: { ...values({ rowHeight: 44 }), zoom: { keys: [{ frame: 0, value: 1, ease: [0.65, 0, 0.35, 1] }, { frame: 240, value: 3, ease: LINEAR }] } },
    }),
    { ...extruderProject().layers[0], visible: false, params: { ...extruderProject().layers[0].params, ...values({ size: 2 }) } },
  ]);

/** Chart de Inception con trazo progresivo. */
export const chartProject = () => {
  const { 'Inception · Calidad vs. tamaño': preset } = chartPresets as Record<string, Record<string, ParamValue>>;
  return makeProject([
    makeLayer('chart', 'chart', {
      params: {
        ...values(preset),
        axes: { keys: [{ frame: 0, value: 0, ease: EASE_OUT }, { frame: 45, value: 1, ease: LINEAR }] },
        progress: { keys: [{ frame: 30, value: 0, ease: [0.65, 0, 0.35, 1] }, { frame: 240, value: 1, ease: LINEAR }] },
      },
    }),
  ]);
};

/** Tabla de Mercury 3 con filas en cascada y columna destacada. */
export const tableProject = () => {
  const { 'Inception · Mercury 3': preset } = tablePresets as Record<string, Record<string, ParamValue>>;
  return makeProject([
    makeLayer('tabla', 'table', {
      params: {
        ...values(preset),
        reveal: { keys: [{ frame: 15, value: 0, ease: LINEAR }, { frame: 150, value: 1, ease: LINEAR }] },
        highlight: { keys: [{ frame: 160, value: 0, ease: [0.65, 0, 0.35, 1] }, { frame: 210, value: 1, ease: LINEAR }] },
        dim: { keys: [{ frame: 210, value: 0, ease: [0.65, 0, 0.35, 1] }, { frame: 250, value: 1, ease: LINEAR }] },
      },
    }),
  ]);
};

/** Dos Tag Shader con parámetros distintos: cada uno se renderiza a su target. */
export const twoTagsProject = () =>
  makeProject([
    makeLayer('arriba', 'tag-shader', {
      seed: 11,
      blend: 'screen',
      params: values({ rowHeight: 44, c0: '#000000', c2: '#FF0000', words: 'UNO\nDOS\nTRES', speed: 0.3 }),
    }),
    makeLayer('abajo', 'tag-shader', { seed: 7 }),
  ]);

/** Texto sobre Tag Shader, para ver el alfa y el compositor. */
export const comboProject = () => {
  const [text] = textProject().layers;
  return makeProject([{ ...text, params: { ...text.params, ...values({ color: '#FF0000' }) } }, ...tagProject().layers]);
};
