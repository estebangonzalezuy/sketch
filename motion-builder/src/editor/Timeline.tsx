import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { evaluateTrack } from '../core/evaluate';
import type { Keyframe, Layer, ParamTrack, Project } from '../core/project';
import type { ToolDefinition } from '../core/tool';
import { deleteLayer, hasKeyAt, insideClip, LAYER_TRACK_IDS, localAt, moveAllKeys, moveClip, moveKey, moveLayerTo, specOf, splitClip, toggleKey, trackLabel, trackOf, trimEnd, trimStart, updateTrack } from './ops';
import { useEditor, type EditorStore } from './store';

const LABEL_WIDTH = 180;
const TICK_STEPS = [1, 2, 5, 10, 15, 30, 60, 150, 300, 600, 1800, 3600];

type Props = { store: EditorStore; tools: readonly ToolDefinition[] };

/** Arrastre con pointer events. Entrega los frames enteros de desplazamiento: snap a frames por construcción. */
function dragFrames(e: ReactPointerEvent, pxPerFrame: number, onMove: (frames: number) => void, onEnd?: () => void) {
  e.stopPropagation();
  e.preventDefault();
  const x0 = e.clientX;
  let moved = false;
  const move = (ev: PointerEvent) => {
    const frames = Math.round((ev.clientX - x0) / pxPerFrame);
    if (!moved && frames === 0) return;
    moved = true;
    onMove(frames);
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    onEnd?.();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

const timecode = (frame: number, fps: number) => `${Math.floor(frame / fps)}:${String(frame % fps).padStart(2, '0')}`;

function Ruler({ store, frames, fps, pxPerFrame }: { store: EditorStore; frames: number; fps: number; pxPerFrame: number }) {
  const lane = useRef<HTMLDivElement>(null);
  const step = TICK_STEPS.find((s) => s * pxPerFrame >= 64) ?? 7200;
  const ticks = Array.from({ length: Math.floor(frames / step) + 1 }, (_, i) => i * step);

  const scrubTo = (clientX: number) => {
    store.setPlaying(false);
    store.setFrame((clientX - lane.current!.getBoundingClientRect().left) / pxPerFrame);
  };
  const down = (e: ReactPointerEvent) => {
    e.preventDefault();
    scrubTo(e.clientX);
    const move = (ev: PointerEvent) => scrubTo(ev.clientX);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="tl-ruler" ref={lane} onPointerDown={down} data-ruler>
      {ticks.map((t) => (
        <span key={t} className="tl-tick" style={{ left: t * pxPerFrame }}>
          {timecode(t, fps)}
        </span>
      ))}
    </div>
  );
}

function KeyMarks({ store, layer, trackId, track, pxPerFrame }: { store: EditorStore; layer: Layer; trackId: string; track: Extract<ParamTrack, { keys: Keyframe[] }>; pxPerFrame: number }) {
  const selected = useEditor(store, (s) => s.selectedKey);

  const down = (e: ReactPointerEvent, frame: number) => {
    store.selectKey({ layerId: layer.id, trackId, frame });
    const base = store.getState().project;
    const gesture = `key.${layer.id}.${trackId}.${frame}.${e.timeStamp}`;
    if (e.altKey) {
      // Alt: mueve la animación entera de la capa.
      dragFrames(e, pxPerFrame, (delta) => {
        store.edit(() => moveAllKeys(base, layer.id, delta), gesture);
        const moved = trackOf(store.getState().project.layers.find((l) => l.id === layer.id)!, trackId);
        const shift = 'keys' in moved && 'keys' in track ? moved.keys[0].frame - track.keys[0].frame : 0;
        store.selectKey({ layerId: layer.id, trackId, frame: frame + shift });
      });
      return;
    }
    dragFrames(e, pxPerFrame, (delta) => {
      const to = Math.max(layer.offset, Math.min(layer.offset + layer.durationFrames - 1, frame + delta));
      store.edit(() => (to === frame ? base : updateTrack(base, layer.id, trackId, (t) => moveKey(t, frame, to))), gesture);
      store.selectKey({ layerId: layer.id, trackId, frame: to });
    });
  };

  return (
    <>
      {track.keys.filter((k) => k.frame >= layer.offset && k.frame < layer.offset + layer.durationFrames).map((k) => (
        <button
          key={k.frame}
          className="tl-key"
          data-key={`${trackId}:${k.frame}`}
          data-selected={selected?.layerId === layer.id && selected.trackId === trackId && selected.frame === k.frame}
          data-hold={k.ease === 'hold'}
          aria-label={`Keyframe ${trackId} en frame ${k.frame}`}
          style={{ left: (layer.start + k.frame - layer.offset) * pxPerFrame }}
          onPointerDown={(e) => down(e, k.frame)}
        />
      ))}
    </>
  );
}

function Clip({ store, layer, pxPerFrame }: { store: EditorStore; layer: Layer; pxPerFrame: number }) {
  const edit = (e: ReactPointerEvent, kind: 'move' | 'start' | 'end') => {
    const base = store.getState().project;
    store.select(layer.id);
    const gesture = `clip.${layer.id}.${kind}.${e.timeStamp}`;
    dragFrames(e, pxPerFrame, (delta) => {
      store.edit(() => {
        if (kind === 'move') return moveClip(base, layer.id, layer.start + delta);
        if (kind === 'start') return trimStart(base, layer.id, layer.start + delta);
        return trimEnd(base, layer.id, layer.start + layer.durationFrames + delta);
      }, gesture);
    });
  };

  return (
    <div
      className="tl-clip"
      data-clip={layer.id}
      data-hidden={!layer.visible}
      style={{ left: layer.start * pxPerFrame, width: layer.durationFrames * pxPerFrame }}
      onPointerDown={(e) => edit(e, 'move')}
    >
      <span className="tl-grip" data-grip="start" onPointerDown={(e) => edit(e, 'start')} />
      <span className="tl-clip-name">{layer.name}</span>
      <span className="tl-grip" data-grip="end" onPointerDown={(e) => edit(e, 'end')} />
    </div>
  );
}

function TrackRow({ store, layer, tools, trackId, pxPerFrame }: Props & { layer: Layer; trackId: string; pxPerFrame: number }) {
  const tool = tools.find((t) => t.id === layer.toolId);
  const frame = useEditor(store, (s) => s.frame);
  const specs = tool?.params ?? {};
  const spec = specOf(specs, trackId);
  const track = trackOf(layer, trackId);
  if (!track || !('keys' in track) || !spec) return null;

  const at = localAt(layer, frame);
  const value = evaluateTrack(track, spec, at);
  const shown = typeof value === 'number' ? value.toFixed(2) : Array.isArray(value) ? value.map((v) => v.toFixed(2)).join(', ') : String(value).slice(0, 10);
  const addAt = (x: number) => {
    const timelineFrame = Math.round(x / pxPerFrame);
    if (!insideClip(layer, timelineFrame)) return;
    const local = timelineFrame - layer.start + layer.offset;
    if (hasKeyAt(track, local)) return;
    store.edit((p) => updateTrack(p, layer.id, trackId, (t) => toggleKey(t, spec, local)));
  };

  return (
    <div className="tl-row tl-track" data-track={trackId}>
      <div className="tl-label">
        <span className="tl-track-name">{trackLabel(specs, trackId)}</span>
        <small>{shown}</small>
      </div>
      <div className="tl-lane" onDoubleClick={(e) => addAt(e.clientX - e.currentTarget.getBoundingClientRect().left)}>
        <KeyMarks store={store} layer={layer} trackId={trackId} track={track} pxPerFrame={pxPerFrame} />
      </div>
    </div>
  );
}

function LayerRows({ store, tools, layer, index, pxPerFrame, open, onToggle, rowsRef }: Props & { layer: Layer; index: number; pxPerFrame: number; open: boolean; onToggle: () => void; rowsRef: React.RefObject<HTMLDivElement | null> }) {
  const selected = useEditor(store, (s) => s.selectedLayerId === layer.id);
  const tracks = [
    ...LAYER_TRACK_IDS.filter((id) => 'keys' in trackOf(layer, id)),
    ...Object.keys(layer.params).filter((id) => 'keys' in layer.params[id]),
  ];

  /** Reordena soltando sobre otra fila de capa. */
  const reorder = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    store.select(layer.id);
    const y = e.clientY;
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointerup', up);
      if (Math.abs(ev.clientY - y) < 4) return;
      const heads = [...rowsRef.current!.querySelectorAll('[data-layer-row]')];
      const over = heads.findIndex((h) => {
        const r = h.getBoundingClientRect();
        return ev.clientY < r.bottom;
      });
      store.edit((p) => moveLayerTo(p, layer.id, over === -1 ? heads.length - 1 : over));
    };
    window.addEventListener('pointerup', up);
  };

  return (
    <>
      <div className="tl-row" data-layer-row={layer.id} data-index={index} data-selected={selected}>
        <div className="tl-label tl-layer-label" onPointerDown={reorder}>
          <button className="tl-fold" aria-expanded={open} aria-label={`${open ? 'Plegar' : 'Desplegar'} pistas de ${layer.name}`} onClick={onToggle}>
            {open ? '▾' : '▸'}
          </button>
          <span className="tl-layer-name">{layer.name}</span>
          <button className="tl-delete" title="Borrar capa (Supr)" aria-label={`Borrar capa ${layer.name}`} onClick={() => deleteLayer(store, layer.id)}>×</button>
        </div>
        <div className="tl-lane">
          <Clip store={store} layer={layer} pxPerFrame={pxPerFrame} />
        </div>
      </div>
      {open && tracks.map((id) => <TrackRow key={id} store={store} tools={tools} layer={layer} trackId={id} pxPerFrame={pxPerFrame} />)}
      {open && tracks.length === 0 && (
        <div className="tl-row tl-track">
          <div className="tl-label"><small>Sin keyframes. Usá ◇ en el panel.</small></div>
          <div className="tl-lane" />
        </div>
      )}
    </>
  );
}

const contentFrames = (p: Project) => Math.max(p.durationFrames, ...p.layers.map((l) => l.start + l.durationFrames));

/** Corta en el playhead la capa seleccionada, o la capa de arriba que lo cubra. */
export function cutAtPlayhead(store: EditorStore) {
  const { project, selectedLayerId, frame } = store.getState();
  const selected = project.layers.find((l) => l.id === selectedLayerId);
  const layer = selected && insideClip(selected, frame) ? selected : project.layers.find((l) => insideClip(l, frame));
  if (!layer) return;
  let id: string | null = null;
  store.edit((p) => {
    const cut = splitClip(p, layer.id, frame);
    id = cut.id;
    return cut.project;
  });
  if (id) store.select(id);
}

export function Timeline({ store, tools }: Props) {
  const project = useEditor(store, (s) => s.project);
  const frame = useEditor(store, (s) => s.frame);
  const playing = useEditor(store, (s) => s.playing);
  const canUndo = useEditor(store, (s) => s.past.length > 0);
  const canRedo = useEditor(store, (s) => s.future.length > 0);
  const canCut = useEditor(store, (s) => s.project.layers.some((l) => s.frame > l.start && s.frame < l.start + l.durationFrames));
  const [pxPerFrame, setPxPerFrame] = useState(3);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const rows = useRef<HTMLDivElement>(null);

  const frames = contentFrames(project);
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !(o[id] ?? true) }));

  return (
    <section className="timeline" aria-label="Timeline">
      <div className="tl-bar">
        <button aria-pressed={playing} onClick={() => store.setPlaying(!playing)}>{playing ? 'Pausa' : 'Play'}</button>
        <output className="frame-count" data-frame={frame}>{timecode(frame, project.fps)} · {frame} / {project.durationFrames - 1}</output>
        <button disabled={!canCut} title="Cortar el clip en el playhead (S)" onClick={() => cutAtPlayhead(store)}>Cortar</button>
        <button disabled={!canUndo} onClick={() => store.undo()}>Deshacer</button>
        <button disabled={!canRedo} onClick={() => store.redo()}>Rehacer</button>
        <label className="tl-zoom">
          Zoom
          <input type="range" aria-label="Zoom del timeline" min={-2} max={4} step={0.1} value={Math.log2(pxPerFrame)} onChange={(e) => setPxPerFrame(2 ** Number(e.target.value))} />
        </label>
      </div>
      <div className="tl-scroll">
        <div className="tl-content" ref={rows} style={{ width: LABEL_WIDTH + frames * pxPerFrame + 40 }}>
          <div className="tl-row tl-head">
            <div className="tl-label" />
            <Ruler store={store} frames={frames} fps={project.fps} pxPerFrame={pxPerFrame} />
          </div>
          <div className="tl-outside" style={{ left: LABEL_WIDTH + project.durationFrames * pxPerFrame }} />
          {project.layers.map((layer, i) => (
            <LayerRows
              key={layer.id}
              store={store}
              tools={tools}
              layer={layer}
              index={i}
              pxPerFrame={pxPerFrame}
              open={open[layer.id] ?? true}
              onToggle={() => toggle(layer.id)}
              rowsRef={rows}
            />
          ))}
          <div className="tl-playhead" data-playhead style={{ left: LABEL_WIDTH + frame * pxPerFrame }} />
        </div>
      </div>
    </section>
  );
}
