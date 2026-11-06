import type { ToolDefinition } from '../core/tool';
import { Engine } from '../engine/renderFrame';
import type { EditorStore } from './store';

const previewScale = (width: number, height: number) => Math.min(1, 1920 / Math.max(width, height));

/**
 * Pide frames al motor según el estado del editor. Nunca avanza estado de las tools.
 * Si llega un cambio durante un render, se dibuja el último al terminar: el canvas conserva
 * la última imagen válida mientras prepare reconstruye.
 */
export class Preview {
  readonly engine: Engine;
  private rendering: Promise<void> | null = null;
  private dirty = false;
  private raf = 0;
  private unsubscribe: () => void;
  error: string | null = null;
  shownFrame = -1; // frame que muestra el canvas
  onError: (message: string | null) => void = () => {};

  constructor(private store: EditorStore, canvas: HTMLCanvasElement, tools: readonly ToolDefinition[]) {
    this.engine = new Engine(canvas, tools, store.assets);
    let last = store.getState();
    this.unsubscribe = store.subscribe(() => {
      const state = store.getState();
      if (state.project !== last.project || state.frame !== last.frame) this.request();
      if (state.playing !== last.playing) this.syncPlayback(state.playing);
      last = state;
    });
    this.request();
  }

  request() {
    this.dirty = true;
    this.rendering ??= this.run();
  }

  /** Espera a que el canvas muestre el estado actual. */
  async idle() {
    while (this.rendering) await this.rendering;
  }

  private async run() {
    while (this.dirty) {
      this.dirty = false;
      const { project, frame } = this.store.getState();
      try {
        await this.engine.renderFrame(project, frame, previewScale(project.width, project.height));
        this.shownFrame = frame;
        this.setError(null);
      } catch (e) {
        this.setError((e as Error).message);
      }
    }
    this.rendering = null;
  }

  private setError(message: string | null) {
    if (message === this.error) return;
    this.error = message;
    this.onError(message);
  }

  /** frame = floor(elapsed × fps): puede saltear frames, nunca acumula. */
  private syncPlayback(playing: boolean) {
    cancelAnimationFrame(this.raf);
    if (!playing) return;
    const startFrame = this.store.getState().frame;
    let origin: number | null = null;
    const tick = (now: number) => {
      origin ??= now;
      const { fps, durationFrames } = this.store.getState().project;
      this.store.setFrame((startFrame + Math.floor(((now - origin) / 1000) * fps)) % durationFrames);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.unsubscribe();
    this.engine.dispose();
  }
}
