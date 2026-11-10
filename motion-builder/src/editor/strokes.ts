import type { Layer, Project } from '../core/project';
import type { ToolDefinition } from '../core/tool';
import { formatStrokes, parseStrokes, type StrokePoint } from '../tools/spray/smear';
import { insideClip, localAt, setParam } from './ops';

// Trazos de smear como pista de la capa: el editor los escribe en el parámetro oculto "strokes" y la
// tool los reproduce en preview y export. Con play, un trazo queda repartido en los frames que duró.

export const hasStrokes = (tool: ToolDefinition | undefined) => !!tool?.params.strokes;

export const strokesOf = (layer: Layer) => {
  const t = layer.params.strokes;
  return parseStrokes(t && 'value' in t ? String(t.value) : '');
};

export function canPaint(layer: Layer | undefined, tool: ToolDefinition | undefined, frame: number): boolean {
  return !!layer && hasStrokes(tool) && insideClip(layer, frame);
}

/** Agrega un punto al trazo `index` (o empieza uno nuevo si index es igual a la cantidad de trazos). */
export function addStrokePoint(project: Project, layerId: string, index: number, frame: number, x: number, y: number): Project {
  const layer = project.layers.find((l) => l.id === layerId);
  if (!layer) return project;
  const strokes = strokesOf(layer);
  const point: StrokePoint = { f: localAt(layer, frame), x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  const next = strokes.slice();
  next[index] = [...(next[index] ?? []), point];
  return setParam(project, layerId, 'strokes', formatStrokes(next), frame);
}

export const clearStrokes = (project: Project, layerId: string, frame: number) => setParam(project, layerId, 'strokes', '', frame);
