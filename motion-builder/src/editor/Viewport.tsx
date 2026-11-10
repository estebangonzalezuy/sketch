import { useEffect, useRef, useState } from 'react';
import type { ToolDefinition } from '../core/tool';
import { Preview } from './preview';
import { useEditor, type EditorStore } from './store';
import { addStrokePoint, canPaint, strokesOf } from './strokes';

export function Viewport({ store, tools, onPreview }: { store: EditorStore; tools: readonly ToolDefinition[]; onPreview?: (preview: Preview) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const width = useEditor(store, (s) => s.project.width);
  const height = useEditor(store, (s) => s.project.height);
  const paintable = useEditor(store, (s) => {
    const layer = s.project.layers.find((l) => l.id === s.selectedLayerId);
    return canPaint(layer, tools.find((t) => t.id === layer?.toolId), s.frame) ? layer!.name : null;
  });
  const stroke = useRef<{ layerId: string; index: number } | null>(null);

  // Arrastrar sobre el canvas pinta trazos de smear en la capa seleccionada, si su tool los usa.
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { project, selectedLayerId, frame } = store.getState();
    const layer = project.layers.find((l) => l.id === selectedLayerId);
    if (!layer || !canPaint(layer, tools.find((t) => t.id === layer.toolId), frame)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const index = strokesOf(layer).length;
    stroke.current = { layerId: layer.id, index };
    const { x, y } = point(e);
    store.edit((p) => addStrokePoint(p, layer.id, index, frame, x, y), `strokes:${layer.id}:${index}`);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stroke.current;
    if (!s || !e.buttons) return;
    const { x, y } = point(e);
    store.edit((p) => addStrokePoint(p, s.layerId, s.index, store.getState().frame, x, y), `strokes:${s.layerId}:${s.index}`);
  };
  const up = () => (stroke.current = null);

  useEffect(() => {
    const preview = new Preview(store, canvas.current!, tools);
    preview.onError = setError;
    onPreview?.(preview);
    return () => preview.dispose();
  }, [store, tools, onPreview]);

  return (
    <div className="viewport">
      <canvas
        ref={canvas}
        className="viewport-canvas"
        data-paint={paintable !== null}
        title={paintable ? `Arrastrá para pintar trazos de smear en ${paintable}` : undefined}
        style={{ aspectRatio: `${width} / ${height}` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      {paintable && <div className="paint-hint">Arrastrá para pintar trazos en {paintable}</div>}
      {error && <div className="viewport-error" role="alert">{error}</div>}
    </div>
  );
}
