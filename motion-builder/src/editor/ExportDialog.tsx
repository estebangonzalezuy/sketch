import { useEffect, useRef, useState } from 'react';
import type { ToolDefinition } from '../core/tool';
import { CancelledError, exportProject } from '../engine/export';
import { useEditor, type EditorStore } from './store';

type Format = 'mp4' | 'png';
type Status = { kind: 'idle' | 'done' | 'cancelled' | 'error'; text: string };

const IDLE: Status = { kind: 'idle', text: '' };
const TYPES = {
  mp4: [{ description: 'Video MP4', accept: { 'video/mp4': ['.mp4'] } }],
  png: [{ description: 'Secuencia PNG', accept: { 'application/zip': ['.zip'] } }],
};

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** El export trabaja sobre una foto del proyecto: seguir editando no lo afecta. */
export function ExportDialog({ store, tools }: { store: EditorStore; tools: readonly ToolDefinition[] }) {
  const project = useEditor(store, (s) => s.project);
  const dialog = useRef<HTMLDialogElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [format, setFormat] = useState<Format>('mp4');
  const [bitrate, setBitrate] = useState(50);
  const [background, setBackground] = useState('#000000');
  const [progress, setProgress] = useState<{ done: number; total: number; left: number } | null>(null);
  const [status, setStatus] = useState<Status>(IDLE);

  useEffect(() => () => abort.current?.abort(), []);

  const start = async () => {
    const snapshot = store.getState().project;
    const started = { at: 0 };
    let name = '';
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: `${snapshot.name}.${format === 'mp4' ? 'mp4' : 'zip'}`, types: TYPES[format] as never });
      name = handle.name;
      const file = await handle.createWritable();
      const controller = new AbortController();
      abort.current = controller;
      store.setPlaying(false);
      setStatus(IDLE);
      setProgress({ done: 0, total: snapshot.durationFrames, left: 0 });
      started.at = performance.now();
      await exportProject(snapshot, tools, store.assets, file, {
        format,
        bitrateMbps: bitrate,
        background,
        signal: controller.signal,
        onProgress: (done, total) => {
          const elapsed = performance.now() - started.at;
          setProgress({ done, total, left: (elapsed / done) * (total - done) });
        },
      });
      const size = (await (await handle.getFile()).size) / 1e6;
      setStatus({ kind: 'done', text: `${name}: ${size.toFixed(1)} MB en ${seconds(performance.now() - started.at)}` });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // se cerró el diálogo de archivo
      if (e instanceof CancelledError) setStatus({ kind: 'cancelled', text: 'Export cancelado. No se guardó el archivo.' });
      else setStatus({ kind: 'error', text: (e as Error).message });
    } finally {
      abort.current = null;
      setProgress(null);
    }
  };

  const running = progress !== null;

  return (
    <>
      <button onClick={() => { setStatus(IDLE); dialog.current?.showModal(); }}>Exportar</button>
      <dialog ref={dialog} className="export-dialog" onCancel={(e) => running && e.preventDefault()}>
        <h2>Exportar</h2>
        <p className="export-summary">
          {project.width}×{project.height} · {project.fps} fps · {project.durationFrames} frames
        </p>
        <label>
          Formato
          <select aria-label="Formato de export" value={format} disabled={running} onChange={(e) => setFormat(e.target.value as Format)}>
            <option value="mp4">MP4 H.264</option>
            <option value="png">Secuencia PNG con alfa (.zip)</option>
          </select>
        </label>
        {format === 'mp4' && (
          <>
            <label>
              Bitrate (Mbps)
              <input aria-label="Bitrate" type="number" min={2} max={150} value={bitrate} disabled={running} onChange={(e) => setBitrate(Number(e.target.value) || 2)} />
            </label>
            <label>
              Fondo (MP4 no tiene alfa)
              <input aria-label="Fondo" type="color" value={background} disabled={running} onChange={(e) => setBackground(e.target.value.toUpperCase())} />
            </label>
          </>
        )}
        {progress && (
          <>
            <progress aria-label="Progreso del export" max={progress.total} value={progress.done} />
            <p className="export-status">
              Frame {progress.done} de {progress.total}
              {progress.done > 0 && ` · faltan ${seconds(progress.left)}`}
            </p>
          </>
        )}
        {status.text && <p className="export-status" data-kind={status.kind} role="status">{status.text}</p>}
        <div className="export-actions">
          {running ? (
            <button onClick={() => abort.current?.abort()}>Cancelar export</button>
          ) : (
            <>
              <button onClick={() => dialog.current?.close()}>Cerrar</button>
              <button onClick={() => void start()}>Exportar a archivo</button>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
