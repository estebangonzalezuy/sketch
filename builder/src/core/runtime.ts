// Runtime fuera de React. Es la fuente de verdad de params, semilla, par y formato.
// React solo monta el panel y lee el estado con useSyncExternalStore.
import type { Env, EnvContext, FrameTarget, Timeline } from "./env";
import { FPS } from "./env";
import { FORMATS, type FormatId } from "./formats";
import { FAMILY, loadFonts } from "./fonts";
import { pairAt, PAIRS } from "./palette";
import { changedPaths, clone, deepMerge, defaultsOf } from "./params";
import { prngFor } from "./rng";
import { entryById, type EnvEntry } from "../envs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any;

export interface RuntimeState {
  envId: string | null;
  envTitle: string;
  envNum: string;
  source: string;
  seed: number;
  pair: number;
  invert: boolean;
  fmt: FormatId;
  playing: boolean;
  t: number;
  duration: number;
  fps: number;
  exporting: null | { label: string; progress: number };
  error: string | null;
}

export interface Preset {
  env: string;
  version: string;
  params: P;
  seed: number;
  pair: number;
  invert: boolean;
  fmt: FormatId;
}

type Listener = () => void;

export class Runtime {
  readonly out: HTMLCanvasElement;
  private out2d: CanvasRenderingContext2D;
  private glCanvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private overlay: HTMLCanvasElement | null = null;
  private overlay2d: CanvasRenderingContext2D | null = null;

  env: Env | null = null;
  params: P = {};
  private simFrame = -1; // -1 = estado inválido, hay que reset
  private dirty = true;
  private raf = 0;
  private lastNow = 0;
  private fpsAcc = { frames: 0, since: 0 };
  private listeners = new Set<Listener>();
  private loadToken = 0;
  /** el panel registra acá cómo escribirle valores (R, presets, actions) */
  panelSetValues: ((p: P) => void) | null = null;

  state: RuntimeState = {
    envId: null,
    envTitle: "",
    envNum: "",
    source: "",
    seed: 1842,
    pair: 0,
    invert: false,
    fmt: "4x5",
    playing: true,
    t: 0,
    duration: 10,
    fps: 0,
    exporting: null,
    error: null,
  };

  constructor() {
    this.out = document.createElement("canvas");
    const c = this.out.getContext("2d", { alpha: false, willReadFrequently: false });
    if (!c) throw new Error("sin canvas 2d");
    this.out2d = c;
    this.resize();
  }

  // ── estado observable ──
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getState = () => this.state;
  private set(patch: Partial<RuntimeState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  get timeline(): Timeline {
    return this.env ? this.env.timeline(this.params) : { duration: 10, loop: "cut", fps: FPS };
  }

  get ctx(): EnvContext {
    const { width, height } = FORMATS[this.state.fmt];
    return {
      width,
      height,
      dpr: 1,
      palette: pairAt(this.state.pair, this.state.invert),
      fonts: { family: FAMILY },
      assets: {},
      seed: this.state.seed,
      prng: prngFor(this.state.seed),
    };
  }

  private get target(): FrameTarget {
    if (this.env?.target === "webgl2") {
      return { kind: "webgl2", ctx: this.gl!, overlay: this.overlay2d! };
    }
    return { kind: "canvas2d", ctx: this.out2d };
  }

  private resize() {
    const { width, height } = FORMATS[this.state.fmt];
    for (const c of [this.out, this.glCanvas, this.overlay]) {
      if (c) {
        c.width = width;
        c.height = height;
      }
    }
  }

  private ensureGl() {
    if (this.gl) return;
    this.glCanvas = document.createElement("canvas");
    const gl = this.glCanvas.getContext("webgl2", {
      antialias: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
      alpha: false,
    });
    if (!gl) throw new Error("WebGL2 no disponible en este navegador");
    this.gl = gl;
    this.overlay = document.createElement("canvas");
    this.overlay2d = this.overlay.getContext("2d")!;
    this.resize();
  }

  // ── entornos ──
  async setEnv(entry: EnvEntry, opts: { params?: P; seed?: number; pair?: number; keepPair?: boolean } = {}) {
    if (!entry.load) return;
    const token = ++this.loadToken;
    const mod = await entry.load();
    await loadFonts();
    if (token !== this.loadToken) return;
    const env = mod.default;
    this.env?.dispose?.();
    this.env = env;
    const seed = opts.seed ?? this.state.seed;
    // al abrir un entorno el par sale de la semilla, salvo que venga de la URL / preset
    const pair = opts.pair ?? (opts.keepPair ? this.state.pair : prngFor(seed)(7)() * PAIRS.length) | 0;
    this.params = deepMerge(defaultsOf(env.params), opts.params ?? {});
    this.set({
      envId: env.id,
      envTitle: env.title,
      envNum: env.num ?? entry.num,
      source: env.source ?? "",
      seed,
      pair,
      t: 0,
      error: null,
    });
    try {
      if (env.target === "webgl2") this.ensureGl();
      await env.load?.(this.ctx);
      env.init(this.target, this.ctx, this.params);
    } catch (e) {
      this.set({ error: String((e as Error).message ?? e) });
      throw e;
    }
    this.simFrame = -1;
    this.set({ duration: this.timeline.duration });
    this.dirty = true;
  }

  setParams(next: P) {
    if (!this.env) return;
    const merged = deepMerge(this.params, next);
    const changed = changedPaths(this.params, merged);
    if (!changed.length) return;
    this.params = merged;
    this.env.update(this.params, changed);
    this.set({ duration: this.timeline.duration });
    this.dirty = true;
  }

  /** escribe params desde el builder (R, presets, actions) y sincroniza el panel */
  applyParams(patch: P) {
    this.setParams(patch);
    this.panelSetValues?.(clone(this.params));
  }

  setSeed(seed: number) {
    this.set({ seed });
    this.simFrame = -1;
    this.dirty = true;
  }
  rotatePair() {
    this.set({ pair: (this.state.pair + 1) % PAIRS.length });
    this.dirty = true;
  }
  setPair(i: number) {
    this.set({ pair: ((i % PAIRS.length) + PAIRS.length) % PAIRS.length });
    this.dirty = true;
  }
  toggleInvert() {
    this.set({ invert: !this.state.invert });
    this.dirty = true;
  }
  setFormat(fmt: FormatId) {
    if (fmt === this.state.fmt) return;
    this.set({ fmt });
    this.resize();
    if (this.env) this.env.init(this.target, this.ctx, this.params);
    this.simFrame = -1;
    this.dirty = true;
  }
  togglePlay() {
    this.set({ playing: !this.state.playing });
  }
  setPlaying(playing: boolean) {
    this.set({ playing });
  }
  rewind() {
    this.simFrame = -1;
    this.schedLast = -1;
    this.set({ t: 0 });
    this.dirty = true;
  }

  async runAction(name: string) {
    const env = this.env;
    const fn = env?.actions?.[name];
    if (!fn) return;
    const r = await fn(this.params, this.ctx);
    if (r && r.params) this.applyParams(r.params);
    if (r && r.reset) this.rewind();
    this.dirty = true;
  }

  random(seed: number) {
    if (!this.env) return;
    this.setSeed(seed);
    const patch = this.env.random?.(seed, this.params);
    if (patch) this.applyParams(patch);
    this.rewind();
  }

  preset(): Preset {
    return {
      env: this.env?.id ?? "",
      version: this.env?.version ?? "0",
      params: clone(this.params),
      seed: this.state.seed,
      pair: this.state.pair,
      invert: this.state.invert,
      fmt: this.state.fmt,
    };
  }

  async loadPreset(pr: Partial<Preset> & { palette?: number }) {
    const entry = entryById(pr.env ?? this.state.envId);
    if (!entry) throw new Error(`entorno desconocido: ${pr.env}`);
    if (pr.fmt) this.setFormat(pr.fmt);
    if (pr.invert !== undefined) this.set({ invert: pr.invert });
    const pair = pr.pair ?? pr.palette; // ENV-INTERFACE usa `palette`
    if (entry.id !== this.state.envId) {
      await this.setEnv(entry, { params: pr.params, seed: pr.seed, pair });
    } else {
      if (pr.seed !== undefined) this.setSeed(pr.seed);
      if (pair !== undefined) this.setPair(pair);
      if (pr.params) this.applyParams(deepMerge(defaultsOf(this.env!.params), pr.params));
    }
    this.panelSetValues?.(clone(this.params));
    this.rewind();
  }

  // ── render determinista ──
  /** Dibuja el cuadro de tiempo t en el canvas de salida. Mismos params + semilla + t = mismo cuadro. */
  renderAt(t: number) {
    const env = this.env;
    if (!env) return;
    const ctx = this.ctx;
    if (env.step && env.reset) {
      const n = Math.round(t * FPS);
      if (this.simFrame < 0 || n < this.simFrame) {
        env.reset(this.state.seed, this.params);
        this.simFrame = 0;
      }
      while (this.simFrame < n) {
        env.step(1 / FPS, this.params);
        this.simFrame++;
      }
    }
    const target = this.target;
    const o = this.out2d;
    o.setTransform(1, 0, 0, 1, 0, 0);
    if (target.kind === "webgl2") {
      const ov = target.overlay;
      ov.setTransform(1, 0, 0, 1, 0, 0);
      ov.clearRect(0, 0, ctx.width, ctx.height);
      env.render(target, t, this.params, ctx);
      o.drawImage(this.glCanvas!, 0, 0);
      o.drawImage(this.overlay!, 0, 0);
    } else {
      env.render(target, t, this.params, ctx);
    }
  }

  /** t de un frame del export */
  frameTime(i: number) {
    return i / FPS;
  }

  // ── loop de preview ──
  start() {
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      const dt = this.lastNow ? Math.min((now - this.lastNow) / 1000, 0.25) : 0;
      this.lastNow = now;
      if (!this.env || this.state.exporting) return;
      let t = this.state.t;
      if (this.state.playing) {
        t += dt;
        const tl = this.timeline;
        if (t >= tl.duration) t = tl.loop === "hold" ? tl.duration : t % tl.duration;
        this.dirty = true;
        this.scheduleAhead(t, tl.duration);
      } else this.schedLast = -1;
      if (!this.dirty) return;
      this.dirty = false;
      // cuantizado a 30 fps: lo que se ve es lo que se exporta
      const tq = Math.floor(t * FPS) / FPS;
      try {
        this.renderAt(tq);
      } catch (e) {
        this.set({ error: String((e as Error).message ?? e), playing: false });
      }
      this.fpsAcc.frames++;
      if (now - this.fpsAcc.since > 1000) {
        const fps = this.state.playing ? Math.round((this.fpsAcc.frames * 1000) / (now - this.fpsAcc.since)) : 0;
        this.fpsAcc = { frames: 0, since: now };
        this.set({ t, fps });
      } else this.state = { ...this.state, t };
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  // ── eventos en vivo con lookahead (audio/MIDI) ──
  // Se lleva cuánto tiempo por delante de `now` ya está agendado (`schedAhead`), no una posición absoluta:
  // así la vuelta del loop no reabre la ventana (antes duplicaba el primer golpe de cada ciclo).
  private schedLast = -1;
  private schedAhead = 0;
  private scheduleAhead(now: number, duration: number) {
    const env = this.env;
    if (!env?.schedule) return;
    const LOOK = 0.12;
    if (this.schedLast < 0) this.schedAhead = 0;
    else {
      let elapsed = now - this.schedLast;
      if (elapsed < 0) elapsed += duration; // vuelta del loop
      this.schedAhead = elapsed > 0.5 ? 0 : Math.max(0, this.schedAhead - elapsed); // > 0,5 s = salto
    }
    this.schedLast = now;
    const from = now + this.schedAhead;
    const to = now + LOOK;
    if (to <= from) return;
    try {
      if (to <= duration) env.schedule(from, to, now, this.params);
      else if (from >= duration) env.schedule(from - duration, to - duration, now - duration, this.params);
      else {
        // la ventana cruza el final del loop: se parte en dos
        env.schedule(from, duration, now, this.params);
        env.schedule(0, to - duration, now - duration, this.params);
      }
    } catch (e) {
      console.warn(e);
    }
    this.schedAhead = LOOK;
  }

  invalidate() {
    this.dirty = true;
  }

  setExporting(v: RuntimeState["exporting"]) {
    this.set({ exporting: v });
    if (!v) {
      this.simFrame = -1;
      this.dirty = true;
    }
  }

  /** t observable para el status (se refresca 1 vez por segundo + en cambios) */
  pokeState() {
    this.set({});
  }
}
