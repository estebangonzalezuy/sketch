import { useSyncExternalStore } from 'react';
import type { Project } from '../core/project';
import { AssetLibrary } from '../engine/assets';

export type KeySelection = { layerId: string; trackId: string; frame: number };

export type EditorState = {
  project: Project; // fuente de verdad: los controles leen de acá
  past: Project[];
  future: Project[];
  selectedLayerId: string | null;
  selectedKey: KeySelection | null;
  frame: number;
  playing: boolean;
};

const HISTORY_LIMIT = 200;

export class EditorStore {
  readonly assets = new AssetLibrary();
  private state: EditorState;
  private listeners = new Set<() => void>();
  private gesture: string | null = null; // cambios seguidos con la misma clave son un solo paso de undo

  constructor(project: Project) {
    this.state = { project, past: [], future: [], selectedLayerId: project.layers[0]?.id ?? null, selectedKey: null, frame: 0, playing: false };
  }

  getState = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  private set(change: Partial<EditorState>) {
    this.state = { ...this.state, ...change };
    this.listeners.forEach((l) => l());
  }

  /** Todo cambio del proyecto pasa por acá. Un arrastre de slider usa la misma clave hasta endGesture. */
  edit(change: (project: Project) => Project, gesture?: string) {
    const { project, past } = this.state;
    const next = change(project);
    if (next === project) return;
    const merge = gesture !== undefined && gesture === this.gesture;
    this.gesture = gesture ?? null;
    this.set({ project: next, future: [], past: merge ? past : [...past, project].slice(-HISTORY_LIMIT), frame: this.clampFrame(next) });
  }

  /** Reemplaza el proyecto entero, al abrir o empezar uno. No se puede deshacer. */
  load(project: Project) {
    this.gesture = null;
    this.set({ project, past: [], future: [], selectedLayerId: project.layers[0]?.id ?? null, selectedKey: null, frame: 0, playing: false });
  }

  endGesture() {
    this.gesture = null;
  }

  undo() {
    const { past, project, future } = this.state;
    const previous = past[past.length - 1];
    if (!previous) return;
    this.gesture = null;
    this.set({ project: previous, past: past.slice(0, -1), future: [project, ...future], frame: this.clampFrame(previous), ...this.keepSelection(previous) });
  }

  redo() {
    const { past, project, future } = this.state;
    const [next, ...rest] = future;
    if (!next) return;
    this.gesture = null;
    this.set({ project: next, past: [...past, project], future: rest, frame: this.clampFrame(next), ...this.keepSelection(next) });
  }

  select(selectedLayerId: string | null) {
    this.set({ selectedLayerId, selectedKey: null });
  }

  selectKey(selectedKey: KeySelection | null) {
    this.set({ selectedKey, ...(selectedKey ? { selectedLayerId: selectedKey.layerId } : {}) });
  }

  /** El frame no es parte del proyecto: no entra en undo. */
  setFrame(frame: number) {
    this.set({ frame: Math.min(Math.max(Math.round(frame), 0), this.state.project.durationFrames - 1) });
  }

  private clampFrame(project: Project) {
    return Math.min(this.state.frame, project.durationFrames - 1);
  }

  setPlaying(playing: boolean) {
    this.set({ playing });
  }

  private keepSelection(project: Project) {
    const { selectedLayerId } = this.state;
    return project.layers.some((l) => l.id === selectedLayerId) ? {} : { selectedLayerId: project.layers[0]?.id ?? null };
  }
}

export const useEditor = <T,>(store: EditorStore, select: (state: EditorState) => T) =>
  useSyncExternalStore(store.subscribe, () => select(store.getState()));
