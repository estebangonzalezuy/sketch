import { useEffect, useRef, useState } from 'react';
import type { ToolDefinition } from '../core/tool';
import { Preview } from './preview';
import { useEditor, type EditorStore } from './store';

export function Viewport({ store, tools, onPreview }: { store: EditorStore; tools: readonly ToolDefinition[]; onPreview?: (preview: Preview) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const width = useEditor(store, (s) => s.project.width);
  const height = useEditor(store, (s) => s.project.height);

  useEffect(() => {
    const preview = new Preview(store, canvas.current!, tools);
    preview.onError = setError;
    onPreview?.(preview);
    return () => preview.dispose();
  }, [store, tools, onPreview]);

  return (
    <div className="viewport">
      <canvas ref={canvas} className="viewport-canvas" style={{ aspectRatio: `${width} / ${height}` }} />
      {error && <div className="viewport-error" role="alert">{error}</div>}
    </div>
  );
}
