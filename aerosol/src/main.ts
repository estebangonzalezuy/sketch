import './style.css';
import { Renderer, STYLES, type FrameParams, type SourceRef, type Style } from './gl/renderer';
import { fromCanvas, fromFile, sampleColors, seekVideo, type MediaItem } from './media';
import {
  BRAND_NAME,
  PRESET_NAMES,
  brandPalette,
  extractPalette,
  luma,
  photoPalette,
  rgbToHex,
  rgbToOklab,
  type Palette,
  type PresetName,
  type RGB,
} from './palette';
import { bloom, portrait } from './samples';
import { drawText, loadBrandFont } from './text';
import { clipDuration, sampleTimeline, totalDuration, type Clip } from './timeline';
import { Brush, eventsBetween, type TouchEvt } from './touch';
import { download, exportVideo } from './export';
import { el, section, segmented, slider, type Control } from './ui';
import { BASE_MODE, MODES, dialDefaults, getMode, modesIn } from './modes/registry';
import { GROUPS, type Dial, type DialValue, type DialValues, type ModeDef } from './modes/types';
import { buildDials, type DialControl } from './modes/panel';
import { IMPLS } from './modes/impl';
import { LOCKED_PAIRS, getPair, guardColor, nextPair, randomPair } from './pairs';
import { hexToRgb } from './palette';

// ---------------------------------------------------------------- Parámetros

const FRAMES = { '3:2': [3, 2], '1:1': [1, 1], '4:5': [4, 5], '9:16': [9, 16], '16:9': [16, 9] } as const;
type FrameKey = keyof typeof FRAMES;
type Tab = 'photo' | 'brand';

interface Params {
  res: '720p' | '1080p';
  frame: FrameKey;
  text: string;
  textSize: number;
  lineGap: number;
  textEffect: number;
  textHeight: number;
  textColor: { photo: number; brand: number };
  brush: number;
  spring: number;
  tab: Tab;
  active: { photo: number[] | null; brand: number[] | null };
  preset: { photo: PresetName | null; brand: PresetName | null };
  brandMix: number;
  style: Style;
  flatten: number;
  airbrush: number;
  grain: number;
  saturation: number;
  pale: number;
  boil: number;
  wave: number;
  glass: number;
  chroma: number;
  glow: number;
  hold: number;
  fade: number;
  /** Modo activo (id del registro) y valores de diales por modo. */
  mode: string;
  dials: Record<string, DialValues>;
  /** Flags "fuera de pares locked" prendidos, por modo. */
  flags: Record<string, string[]>;
  /** Par locked activo (se sortea al cargar) e inversión campo/figura. */
  pair: string;
  invert: boolean;
}

const DEFAULTS: Params = {
  res: '1080p',
  frame: '4:5',
  text: 'Vibe\nCheck',
  textSize: 0.28,
  lineGap: 0.8,
  textEffect: 0.5,
  textHeight: 0.5,
  textColor: { photo: -1, brand: -1 },
  brush: 0.12,
  spring: 0.2,
  tab: 'brand',
  active: { photo: null, brand: null },
  preset: { photo: 'Full', brand: 'Full' },
  brandMix: 0.7,
  style: 'spray',
  flatten: 7,
  airbrush: 4,
  grain: 22,
  saturation: 1.45,
  pale: 0.3,
  boil: 1,
  wave: 0,
  glass: 0,
  chroma: 0,
  glow: 0,
  hold: 2.2,
  fade: 1.2,
  mode: BASE_MODE,
  dials: {},
  flags: {},
  pair: LOCKED_PAIRS[0].id,
  invert: false,
};

const STORE_KEY = 'aerosol:params:v1';

function loadParams(): Params {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = { ...structuredClone(DEFAULTS), ...JSON.parse(raw) } as Params;
      if (!(p.frame in FRAMES)) p.frame = DEFAULTS.frame;
      if (!STYLES.includes(p.style)) p.style = DEFAULTS.style;
      if (!MODES.some((m) => m.id === p.mode)) p.mode = BASE_MODE;
      return p;
    }
  } catch {
    // almacenamiento no disponible
  }
  return structuredClone(DEFAULTS);
}

const params = loadParams();
// Al cargar, uno de los 4 pares locked al azar.
params.pair = randomPair().id;
params.invert = false;
let saveTimer = 0;
function save(): void {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(params));
    } catch {
      // sin persistencia
    }
  }, 300);
}

// ---------------------------------------------------------------- Estado

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
let renderer: Renderer;
try {
  renderer = new Renderer(canvas);
} catch (e) {
  document.querySelector('#viewport')!.textContent = String(e instanceof Error ? e.message : e);
  throw e;
}

const media: MediaItem[] = [];
const brand = brandPalette();
let photo: Palette = brand;
let pixelSamples = new Float32Array(0);
let time = 0;
let boilClock = 0;
let playing = true;
let exporting = false;
let recording = false;
let events: TouchEvt[] = [];
const textCanvas = document.createElement('canvas');
let hasText = false;

const brush = new Brush(
  () => renderer.width / renderer.height,
  () => params.brush,
);

function frameSize(): [number, number] {
  const short = params.res === '720p' ? 720 : 1080;
  const [rw, rh] = FRAMES[params.frame];
  const even = (x: number) => Math.round(x / 2) * 2;
  return rw >= rh ? [even((short * rw) / rh), short] : [short, even((short * rh) / rw)];
}

function mode(): ModeDef {
  return getMode(params.mode);
}

function isBase(): boolean {
  return mode().group === 'Base';
}

function modeValues(m: ModeDef = mode()): DialValues {
  const own = (params.dials[m.id] ??= {});
  const out: DialValues = { ...dialDefaults(m.dials) };
  for (const d of m.dials) out[d.id] = d.bind ? (params as unknown as Record<string, DialValue>)[d.bind] : (own[d.id] ?? d.default);
  return out;
}

function flagOn(id: string): boolean {
  return (params.flags[params.mode] ?? []).includes(id);
}

/** Largo del loop: la línea de tiempo de media en Base, el loop del modo en los demás. */
function loopLength(): number {
  if (isBase()) return totalDuration(clips());
  return IMPLS[params.mode]?.duration(modeValues()) ?? 2;
}

function clips(): Clip[] {
  return media.map((m) => ({ duration: clipDuration(m.kind, params.hold, m.videoDuration) }));
}

/** Tintas activas: el par locked, o el de un flag "fuera de pares locked" prendido. */
function inks(): { field: RGB; figure: RGB; label: string; unlocked: boolean } {
  const flag = mode().optionalUnlocked.find((f) => f.pair && flagOn(f.id));
  const src = flag?.pair ?? getPair(params.pair);
  let field = hexToRgb(src.field);
  let figure = hexToRgb(src.figure);
  if (params.invert) [field, figure] = [figure, field];
  return { field, figure, label: flag ? flag.label : getPair(params.pair).label, unlocked: !!flag };
}

/** Sin el flag de paleta completa, toda pieza usa solo las 2 tintas del par. */
function lockedPalette(): boolean {
  return !(isBase() && flagOn('full-palette'));
}

function pairPalette(): Palette {
  const { field, figure } = inks();
  const all = [0, 1];
  return {
    colors: [field, figure],
    names: ['Field', 'Figure'],
    presets: { Full: all, Primary: all, Duo: all, Warm: all, Cool: all },
    paper: field,
    text: 1,
  };
}

function palette(): Palette {
  if (lockedPalette()) return pairPalette();
  return params.tab === 'brand' ? brand : photo;
}

function activeIdx(): number[] {
  const pal = palette();
  if (lockedPalette()) return [0, 1];
  const list = params.active[params.tab];
  if (list) return list.filter((i) => i < pal.colors.length);
  return pal.presets[params.preset[params.tab] ?? 'Full'];
}

function textColor(): RGB {
  const pal = palette();
  if (lockedPalette()) return pal.colors[pal.text];
  const i = params.textColor[params.tab];
  return pal.colors[i >= 0 && i < pal.colors.length ? i : pal.text];
}

/**
 * Riso: el papel es el color activo más claro (si es claro) y las tintas, los colores activos que
 * más usa la imagen (cada píxel muestreado vota por su color más cercano). Se memoriza por paleta.
 */
let risoCache: { key: string; value: { paper: RGB; inks: RGB[] } } | null = null;
function risoInks(colors: RGB[]): { paper: RGB; inks: RGB[] } {
  const key = JSON.stringify(colors) + pixelSamples.length + media.length;
  if (risoCache?.key === key) return risoCache.value;
  const value = computeRisoInks(colors);
  risoCache = { key, value };
  return value;
}

function computeRisoInks(colors: RGB[]): { paper: RGB; inks: RGB[] } {
  if (colors.length === 0) return { paper: palette().paper, inks: [] };
  const lightest = colors.reduce((a, c) => (luma(c) > luma(a) ? c : a), colors[0]);
  const paper = luma(lightest) > 0.6 ? lightest : palette().paper;
  const candidates = colors.filter((c) => c !== paper);
  const labs = candidates.map(rgbToOklab);
  const lp = rgbToOklab(paper);
  const votes = candidates.map(() => 0);
  for (let j = 0; j < pixelSamples.length; j += 3) {
    const l = rgbToOklab([pixelSamples[j], pixelSamples[j + 1], pixelSamples[j + 2]]);
    let best = -1;
    let bd = (l[0] - lp[0]) ** 2 + (l[1] - lp[1]) ** 2 + (l[2] - lp[2]) ** 2;
    labs.forEach((c, i) => {
      const d = (l[0] - c[0]) ** 2 + (l[1] - c[1]) ** 2 + (l[2] - c[2]) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best >= 0) votes[best]++;
  }
  const n = Math.max(1, pixelSamples.length / 3);
  // Las dos más votadas y una oscura para las sombras (riso casi siempre lleva una tinta oscura).
  const order = candidates
    .map((c, i) => ({ c, v: votes[i] / n }))
    .sort((a, b) => b.v - a.v)
    .map((x) => x.c);
  const darkest = candidates.reduce((a, c) => (luma(c) < luma(a) ? c : a), candidates[0]);
  const top = order.slice(0, 2);
  const third = top.includes(darkest) ? order[2] : darkest;
  return { paper, inks: [...top, third].filter(Boolean) };
}

// ---------------------------------------------------------------- Texto

function refreshText(): void {
  const [w, h] = frameSize();
  hasText = drawText(textCanvas, w, h, {
    text: params.text,
    size: params.textSize,
    lineGap: params.lineGap,
    height: params.textHeight,
  });
  renderer.uploadText(textCanvas);
}

// ---------------------------------------------------------------- Media

function refreshPhotoPalette(): void {
  if (media.length === 0) {
    photo = brand;
  } else {
    const all = sampleColors(media);
    // Los azules retirados nunca llegan a un swatch: se remapean a la tinta de figura.
    photo = photoPalette(extractPalette(all, 8).map((c) => guardColor(c, inks().figure)));
    // Submuestra para los votos de Riso.
    pixelSamples = new Float32Array(Math.floor(all.length / 12) * 3);
    for (let i = 0; i < pixelSamples.length / 3; i++) pixelSamples.set(all.subarray(i * 12, i * 12 + 3), i * 3);
  }
  risoCache = null;
  params.active.photo = null;
  if (params.tab === 'photo') renderColour();
}

async function addFiles(files: FileList | File[]): Promise<void> {
  const list = [...files].filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
  for (const f of list) {
    try {
      media.push(await fromFile(f));
    } catch (e) {
      console.error(e);
    }
  }
  if (list.length) {
    refreshPhotoPalette();
    renderMedia();
  }
}

function removeMedia(i: number): void {
  const [m] = media.splice(i, 1);
  if (m.tex) renderer.deleteTexture(m.tex);
  if (m.el instanceof HTMLVideoElement) m.el.pause();
  if (m.url) URL.revokeObjectURL(m.url);
  refreshPhotoPalette();
  renderMedia();
}

function sourceRef(m: MediaItem | undefined): SourceRef | null {
  if (!m) return null;
  if (!m.tex) m.tex = renderer.texture();
  if (m.kind === 'video') {
    const v = m.el as HTMLVideoElement;
    if (v.readyState >= 2) {
      renderer.upload(m.tex, v);
      m.uploaded = true;
    }
  } else if (!m.uploaded) {
    renderer.upload(m.tex, m.el);
    m.uploaded = true;
  }
  return m.uploaded ? { tex: m.tex, aspect: m.width / m.height } : null;
}

/** En la vista previa los videos corren solos; se corrigen si se desfasan. */
function syncVideosLive(a: number, b: number, localA: number, localB: number): void {
  media.forEach((m, i) => {
    if (m.kind !== 'video') return;
    const v = m.el as HTMLVideoElement;
    const target = i === a ? localA : i === b ? localB : -1;
    if (target < 0) {
      if (!v.paused) v.pause();
      return;
    }
    if (playing) {
      if (v.paused) v.play().catch(() => {});
      if (Math.abs(v.currentTime - target) > 0.3) v.currentTime = target;
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - target) > 0.04) v.currentTime = target;
    }
  });
}

// ---------------------------------------------------------------- Render

// ---------------------------------------------------------------- Capas de modo

const figCanvas = document.createElement('canvas');
const crispCanvas = document.createElement('canvas');
const figCtx = figCanvas.getContext('2d', { willReadFrequently: true })!;
const crispCtx = crispCanvas.getContext('2d')!;
let layerKey = '';
/** Porcentaje de campo vacío de la figura actual (para el panel). */
let emptyShare = -1;

/** Dibuja y sube las capas del modo si cambiaron. Devuelve el frame del modo, o null en Base. */
function modeFrame(t: number): FrameParams['mode'] {
  const impl = IMPLS[params.mode];
  if (isBase() || !impl) return null;
  const v = modeValues();
  const [w, h] = frameSize();
  const key = `${params.mode}|${w}x${h}|${impl.key(t, v)}`;
  if (key !== layerKey) {
    for (const c of [figCanvas, crispCanvas]) {
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
    }
    impl.draw({ fig: figCtx, crisp: crispCtx, w, h }, t, v);
    renderer.uploadModeLayers(figCanvas, crispCanvas);
    layerKey = key;
    measureEmpty(v);
  }
  return impl.frame(t, v);
}

const probe = document.createElement('canvas');
probe.width = 120;
probe.height = 120;
const probeCtx = probe.getContext('2d', { willReadFrequently: true })!;
function measureEmpty(v: DialValues): void {
  probeCtx.clearRect(0, 0, 120, 120);
  probeCtx.drawImage(figCanvas, 0, 0, 120, 120);
  const fig = probeCtx.getImageData(0, 0, 120, 120).data;
  probeCtx.drawImage(crispCanvas, 0, 0, 120, 120);
  const crisp = probeCtx.getImageData(0, 0, 120, 120).data;
  let filled = 0;
  const field = v.fill === 'field';
  for (let i = 0; i < fig.length; i += 4) {
    const f = fig[i] > 127;
    if ((field ? !f : f) || crisp[i] > 127) filled++;
  }
  emptyShare = 1 - filled / (fig.length / 4);
  renderEmpty();
}

function frameParams(t: number, tick: number, a: SourceRef | null, b: SourceRef | null, fade: number): FrameParams {
  const pal = palette();
  const m = modeFrame(t);
  const ink = inks();
  const colors = activeIdx().map((i) => guardColor(pal.colors[i], ink.figure));
  const riso = risoInks(colors);
  return {
    a,
    b,
    fade,
    time: t,
    tick,
    hasText: m ? true : hasText,
    textEffect: m ? 0 : params.textEffect,
    mode: m,
    field: ink.field,
    figure: ink.figure,
    textColor: guardColor(textColor(), ink.figure),
    guard: [ink.field, ink.figure],
    airbrush: params.airbrush,
    saturation: params.saturation,
    pale: params.pale,
    grain: params.grain,
    flatten: params.flatten,
    brandMix: lockedPalette() ? 1 : params.brandMix,
    style: params.style,
    paper: guardColor(pal.paper, ink.field),
    palette: colors,
    paletteLab: colors.map(rgbToOklab),
    inks: riso.inks,
    risoPaper: riso.paper,
    wave: params.wave,
    glass: params.glass,
    chroma: params.chroma,
    glow: params.glow,
  };
}

/** Foto para los modos que la usan (dial Photo): la primera media de la lista, quieta. */
function modePhoto(): SourceRef | null {
  if (!modeValues().photo) return null;
  const m = media.find((x) => x.kind === 'image') ?? media[0];
  return sourceRef(m);
}

function decayFor(dt: number): number {
  return Math.exp(-params.spring * params.spring * 9 * dt);
}

function draw(dt: number): void {
  const [w, h] = frameSize();
  renderer.resize(w, h);
  const tick = params.boil > 0 ? Math.floor(boilClock * params.boil * 24) : 0;
  if (!isBase()) {
    syncVideosLive(-1, -1, 0, 0);
    renderer.updateSmear(decayFor(dt), brush.take(), params.brush);
    renderer.render(frameParams(time, tick, modePhoto(), null, 0));
    currentIndex = -1;
    return;
  }
  const s = sampleTimeline(clips(), time, params.fade);
  syncVideosLive(s.a, s.b, s.localA, s.localB);
  const a = sourceRef(media[s.a]);
  const b = s.b >= 0 ? sourceRef(media[s.b]) : null;
  renderer.updateSmear(decayFor(dt), brush.take(), params.brush);
  renderer.render(frameParams(time, tick, a, b, b ? s.fade : 0));
  currentIndex = s.a;
}

let currentIndex = -1;
let last = performance.now();
let fpsAcc = 0;
let fpsN = 0;
const fpsEl = document.querySelector<HTMLElement>('#fps')!;

function loop(now: number): void {
  requestAnimationFrame(loop);
  if (exporting) {
    last = now;
    return;
  }
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  fpsAcc += dt;
  fpsN++;
  if (fpsAcc > 0.5) {
    fpsEl.textContent = `${Math.round(fpsN / fpsAcc)} fps`;
    fpsAcc = 0;
    fpsN = 0;
  }
  const total = loopLength();
  boilClock += dt;
  if (playing && total > 0) {
    const prev = time;
    time += dt;
    if (time >= total) {
      if (recording) {
        stopRecording();
        time = 0;
      } else {
        time %= total;
      }
      if (events.length) {
        renderer.resetSmear();
        brush.reset();
      }
    }
    if (!recording && events.length) {
      for (const e of eventsBetween(events, prev % total, time, total)) brush.feed(e);
    }
  }
  const prevIndex = currentIndex;
  draw(dt);
  if (prevIndex !== currentIndex) markCurrent();
  updateTransport(total);
}

// ---------------------------------------------------------------- Transport

const playBtn = document.querySelector<HTMLButtonElement>('#play')!;
const scrub = document.querySelector<HTMLInputElement>('#scrub')!;
const clock = document.querySelector<HTMLElement>('#clock')!;
let scrubbing = false;

function setPlaying(p: boolean): void {
  playing = p;
  playBtn.classList.toggle('paused', !p);
  playBtn.setAttribute('aria-label', p ? 'Pause' : 'Play');
}

function updateTransport(total: number): void {
  if (!scrubbing) scrub.value = String(total > 0 ? time / total : 0);
  clock.textContent = `${time.toFixed(1)} / ${total.toFixed(1)} s`;
}

playBtn.addEventListener('click', () => setPlaying(!playing));
scrub.addEventListener('input', () => {
  scrubbing = true;
  time = Number(scrub.value) * loopLength();
});
scrub.addEventListener('change', () => (scrubbing = false));
window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if (e.code === 'Space' && !['TEXTAREA', 'INPUT'].includes(t.tagName) && t.tagName !== 'BUTTON') {
    e.preventDefault();
    setPlaying(!playing);
  }
});

// ---------------------------------------------------------------- Touch

function toFrame(e: PointerEvent): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
}

function touch(e: PointerEvent, type: TouchEvt['type']): void {
  if (exporting) return;
  const p = { ...toFrame(e), type };
  brush.feed(p);
  if (recording) events.push({ ...p, t: time });
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  touch(e, 'down');
});
canvas.addEventListener('pointermove', (e) => {
  if (e.buttons) touch(e, 'move');
});
canvas.addEventListener('pointerup', (e) => touch(e, 'up'));
canvas.addEventListener('pointercancel', (e) => touch(e, 'up'));

const recordBtn = document.querySelector<HTMLButtonElement>('#record')!;
const recBadge = document.querySelector<HTMLElement>('#rec-badge')!;

function startRecording(): void {
  if (isBase() && media.length === 0) return;
  recording = true;
  events = [];
  time = 0;
  renderer.resetSmear();
  brush.reset();
  setPlaying(true);
  recordBtn.textContent = 'Stop recording';
  recordBtn.classList.add('recording');
  recBadge.hidden = false;
  renderTouchStatus();
}

function stopRecording(): void {
  if (!recording) return;
  recording = false;
  // Cierra un gesto que haya quedado abierto al final del loop.
  if (events.length && events[events.length - 1].type !== 'up') {
    const l = events[events.length - 1];
    events.push({ ...l, type: 'up', t: Math.min(l.t + 1e-3, loopLength() - 1e-3) });
  }
  recordBtn.textContent = 'Record with touch';
  recordBtn.classList.remove('recording');
  recBadge.hidden = true;
  renderTouchStatus();
}

recordBtn.addEventListener('click', () => (recording ? stopRecording() : startRecording()));

// ---------------------------------------------------------------- Export

const overlay = document.querySelector<HTMLElement>('#overlay')!;
const progressText = document.querySelector<HTMLElement>('#progress-text')!;
const progressBar = document.querySelector<HTMLElement>('#progress-bar')!;
const exportBtn = document.querySelector<HTMLButtonElement>('#export')!;
let abort: AbortController | null = null;

const cancelBtn = document.querySelector<HTMLButtonElement>('#cancel')!;
cancelBtn.addEventListener('click', () => {
  if (exporting) abort?.abort();
  else overlay.hidden = true;
});

async function runExport(): Promise<void> {
  if (exporting || (isBase() && media.length === 0)) return;
  stopRecording();
  const list = clips();
  const total = loopLength();
  const fps = 30;
  const frames = Math.max(1, Math.round(total * fps));
  const [w, h] = frameSize();
  exporting = true;
  const wasPlaying = playing;
  setPlaying(false);
  media.forEach((m) => m.kind === 'video' && (m.el as HTMLVideoElement).pause());
  abort = new AbortController();
  overlay.hidden = false;
  progressText.textContent = 'Preparing…';
  progressBar.style.width = '0%';
  renderer.resize(w, h);
  renderer.resetSmear();
  brush.reset();
  const dt = 1 / fps;
  let failed = '';
  cancelBtn.textContent = 'Cancel';

  const renderFrame = async (i: number) => {
    const t = i * dt;
    if (i > 0) for (const e of eventsBetween(events, (i - 1) * dt, t, total)) brush.feed(e);
    if (!isBase()) {
      renderer.updateSmear(i === 0 ? 1 : decayFor(dt), brush.take(), params.brush);
      const tick = params.boil > 0 ? Math.floor(t * params.boil * 24) : 0;
      renderer.render(frameParams(t, tick, modePhoto(), null, 0));
      return;
    }
    const s = sampleTimeline(list, t, params.fade);
    for (const [idx, local] of [
      [s.a, s.localA],
      [s.b, s.localB],
    ] as const) {
      const m = media[idx];
      if (m?.kind === 'video') await seekVideo(m.el as HTMLVideoElement, local);
    }
    const a = sourceRef(media[s.a]);
    const b = s.b >= 0 ? sourceRef(media[s.b]) : null;
    renderer.updateSmear(i === 0 ? 1 : decayFor(dt), brush.take(), params.brush);
    const tick = params.boil > 0 ? Math.floor(t * params.boil * 24) : 0;
    renderer.render(frameParams(t, tick, a, b, b ? s.fade : 0));
  };

  try {
    const res = await exportVideo({
      canvas,
      width: w,
      height: h,
      fps,
      frames,
      renderFrame,
      signal: abort.signal,
      onProgress: (d, n) => {
        progressText.textContent = `Rendering frame ${d} of ${n}`;
        progressBar.style.width = `${(d / n) * 100}%`;
      },
    });
    progressText.textContent = 'Saving…';
    await download(res.blob, `aerosol-${params.mode}-${params.frame.replace(':', 'x')}-${params.res}.${res.ext}`);
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'AbortError')) {
      console.error(e);
      failed = `Export failed: ${e instanceof Error ? e.message : e}`;
    }
  } finally {
    // Si falló, el diálogo queda abierto con el error y el botón pasa a "Close".
    overlay.hidden = !failed;
    if (failed) {
      progressText.textContent = failed;
      cancelBtn.textContent = 'Close';
    }
    exporting = false;
    renderer.resetSmear();
    brush.reset();
    time = 0;
    setPlaying(wasPlaying);
  }
}

exportBtn.addEventListener('click', runExport);

/**
 * Still first: guarda el frame del hold (el último del loop) en PNG, a la resolución de export.
 * En Base guarda el frame actual.
 */
async function savePng(): Promise<void> {
  if (exporting) return;
  exporting = true;
  try {
    const [w, h] = frameSize();
    renderer.resize(w, h);
    const t = isBase() ? time : Math.max(0, loopLength() - 1 / 30);
    const tick = params.boil > 0 ? Math.floor(t * params.boil * 24) : 0;
    if (isBase()) {
      draw(0);
    } else {
      renderer.updateSmear(1, brush.take(), params.brush);
      renderer.render(frameParams(t, tick, modePhoto(), null, 0));
    }
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (blob) await download(blob, `aerosol-${params.mode}-hold-${params.frame.replace(':', 'x')}-${params.res}.png`);
  } catch (e) {
    console.error(e);
  } finally {
    exporting = false;
  }
}
document.querySelector('#png')!.addEventListener('click', savePng);

// ---------------------------------------------------------------- Panel izquierdo

const left = document.querySelector<HTMLElement>('#left')!;
const right = document.querySelector<HTMLElement>('#right')!;
const fileInput = document.querySelector<HTMLInputElement>('#file')!;

const dialsBody = section(left, 'Dials');
const dialsRoot = dialsBody.parentElement!;
const dialsHead = dialsRoot.querySelector('.hint')!;
let dialControls: DialControl[] = [];

const mediaBody = section(left, 'Media', 'plays top to bottom');
const mediaRoot = mediaBody.parentElement!;
const mediaList = el('div', { class: 'media-list' });
const addBtn = el('button', { class: 'add', type: 'button' }, '+ Add photos or videos');
addBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files) addFiles(fileInput.files);
  fileInput.value = '';
});
mediaBody.append(
  mediaList,
  addBtn,
  el(
    'p',
    { class: 'note' },
    'Drop files anywhere. Videos play for their own length, up to 30 s; photos use Hold. The two starting images are generated samples.',
  ),
);

let dragFrom = -1;
function renderMedia(): void {
  mediaList.replaceChildren(
    ...media.map((m, i) => {
      const kind = m.kind === 'video' ? `Video · ${m.videoDuration.toFixed(1)} s` : 'Image';
      const remove = el('button', { class: 'media-remove', type: 'button', 'aria-label': `Remove ${m.name}` }, '×');
      remove.addEventListener('click', () => removeMedia(i));
      const row = el(
        'div',
        { class: 'media-row', draggable: 'true' },
        el('img', { src: m.thumb, alt: '' }),
        el('div', {}, el('div', { class: 'media-name' }, m.name), el('div', { class: 'media-kind' }, kind)),
        remove,
      );
      row.addEventListener('click', (e) => {
        if (e.target === remove) return;
        const list = clips();
        time = list.slice(0, i).reduce((s, c) => s + c.duration, 0);
      });
      row.addEventListener('dragstart', (e) => {
        dragFrom = i;
        e.dataTransfer?.setData('text/plain', String(i));
      });
      row.addEventListener('dragover', (e) => {
        if (dragFrom < 0) return;
        e.preventDefault();
        row.classList.add('drag-over');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', (e) => {
        row.classList.remove('drag-over');
        if (dragFrom < 0) return;
        e.preventDefault();
        e.stopPropagation();
        const [moved] = media.splice(dragFrom, 1);
        media.splice(i, 0, moved);
        dragFrom = -1;
        renderMedia();
      });
      row.addEventListener('dragend', () => (dragFrom = -1));
      return row;
    }),
  );
  markCurrent();
}

function markCurrent(): void {
  [...mediaList.children].forEach((r, i) => r.classList.toggle('current', i === currentIndex));
}

// Soltar archivos en cualquier parte
const drop = document.querySelector<HTMLElement>('#drop')!;
let dragDepth = 0;
const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
window.addEventListener('dragenter', (e) => {
  if (!hasFiles(e)) return;
  dragDepth++;
  drop.hidden = false;
});
window.addEventListener('dragleave', (e) => {
  if (!hasFiles(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) drop.hidden = true;
});
window.addEventListener('dragover', (e) => {
  if (hasFiles(e)) e.preventDefault();
});
window.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  drop.hidden = true;
  if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
});

// Texto
const textBody = section(left, 'Text');
const textRoot = textBody.parentElement!;
const textarea = el('textarea', { placeholder: 'Type a headline…', rows: '3', spellcheck: 'false' });
textarea.value = params.text;
textarea.addEventListener('input', () => {
  params.text = textarea.value;
  refreshText();
  save();
});
textBody.append(textarea);
const controls: Record<string, Control<number>> = {};
type NumKey = { [K in keyof Params]: Params[K] extends number ? K : never }[keyof Params];
function numSlider(parent: HTMLElement, key: NumKey, label: string, min: number, max: number, step: number, digits?: number, suffix?: string, after?: () => void) {
  controls[key] = slider(parent, { label, min, max, step, value: DEFAULTS[key], digits, suffix }, (v) => {
    params[key] = v;
    for (const c of dialControls) if (c.dial.bind === key) c.set(v);
    after?.();
    save();
  });
  controls[key].set(params[key]);
}
numSlider(textBody, 'textSize', 'Size', 0.05, 0.6, 0.01, 2, '', refreshText);
numSlider(textBody, 'lineGap', 'Line gap', 0.5, 1.6, 0.01, 2, '', refreshText);
numSlider(textBody, 'textEffect', 'Effect', 0, 1, 0.01, 2);
numSlider(textBody, 'textHeight', 'Height', 0, 1, 0.01, 2, '', refreshText);
const textSwatches = el('div', { class: 'swatches' });
textBody.append(textSwatches);

// Touch
const touchBody = section(left, 'Touch', 'drag on the canvas');
numSlider(touchBody, 'brush', 'Brush', 0.02, 0.4, 0.01, 2);
numSlider(touchBody, 'spring', 'Spring back', 0, 1, 0.01, 2);
const touchStatus = el('span', {});
const clearTouch = el('button', { class: 'link', type: 'button' }, 'Clear');
const resetSmear = el('button', { class: 'link', type: 'button' }, 'Reset smear');
clearTouch.addEventListener('click', () => {
  events = [];
  renderTouchStatus();
});
resetSmear.addEventListener('click', () => {
  renderer.resetSmear();
  brush.reset();
});
touchBody.append(el('div', { class: 'link-row' }, touchStatus, el('span', {}, resetSmear, ' · ', clearTouch)));
if (!renderer.smearOk) touchBody.append(el('p', { class: 'note' }, 'Smear needs float render targets, which this browser lacks.'));

function renderTouchStatus(): void {
  const strokes = events.filter((e) => e.type === 'down').length;
  touchStatus.textContent = recording
    ? 'Recording… drag on the canvas'
    : strokes
      ? `${strokes} recorded stroke${strokes === 1 ? '' : 's'} (exported)`
      : 'No recorded strokes';
  clearTouch.disabled = !strokes || recording;
}

// ---------------------------------------------------------------- Panel derecho

// Modo: selector agrupado (Base, Figma Q3, Moodboard), status, flags y presets.
const modeBody = section(right, 'Mode');
const modeSelect = el('select', { id: 'mode-select', class: 'select', 'aria-label': 'Mode' });
for (const g of GROUPS) {
  const list = modesIn(g);
  const og = el('optgroup', { label: list.length ? g : `${g} (sin modos en este repo)` });
  if (!list.length) og.setAttribute('disabled', '');
  for (const m of list) og.append(el('option', { value: m.id }, m.label));
  if (!list.length) og.append(el('option', { value: '', disabled: '' }, '—'));
  modeSelect.append(og);
}
const modeMeta = el('div', { class: 'mode-meta' });
const flagsBox = el('div', { class: 'flags' });
const presetSave = el('button', { class: 'link', type: 'button' }, 'Save preset');
const presetLoad = el('button', { class: 'link', type: 'button' }, 'Load preset');
const presetInput = el('input', { type: 'file', accept: 'application/json,.json', hidden: '' });
modeBody.append(modeSelect, modeMeta, flagsBox, el('div', { class: 'link-row' }, el('span', {}, presetSave, ' · ', presetLoad), presetInput));
modeSelect.addEventListener('change', () => applyMode(modeSelect.value, true));

function setDial(d: Dial, v: DialValue): void {
  if (d.bind) {
    (params as unknown as Record<string, DialValue>)[d.bind] = v;
    controls[d.bind]?.set(Number(v));
  } else {
    (params.dials[params.mode] ??= {})[d.id] = v;
  }
  layerKey = '';
  save();
}

const emptyEl = el('span', { class: 'empty' });
function renderEmpty(): void {
  const m = mode();
  emptyEl.hidden = isBase() || emptyShare < 0;
  const pct = Math.round(emptyShare * 100);
  emptyEl.textContent = `Empty field ${pct}%` + (m.minEmpty ? ` · target ≥${Math.round(m.minEmpty * 100)}%` : '');
  emptyEl.classList.toggle('low', !!m.minEmpty && emptyShare < m.minEmpty);
}

function renderModeMeta(): void {
  const m = mode();
  modeSelect.value = m.id;
  modeMeta.replaceChildren(
    el('span', { class: `chip ${m.status}` }, m.status === 'aprobada' ? 'Aprobada' : 'Propuesta'),
    el('span', { class: 'hint' }, m.category),
    emptyEl,
  );
  renderEmpty();
  flagsBox.replaceChildren(
    ...m.optionalUnlocked.map((f) => {
      const input = el('input', { type: 'checkbox', id: `flag-${f.id}` });
      input.checked = flagOn(f.id);
      input.addEventListener('change', () => {
        const on = new Set(params.flags[m.id] ?? []);
        if (input.checked) on.add(f.id);
        else on.delete(f.id);
        params.flags[m.id] = [...on];
        onModeVisualsChanged();
        save();
      });
      return el('label', { class: 'toggle flag', for: `flag-${f.id}` }, input, el('span', {}, f.label, el('em', {}, ' · fuera de pares locked')));
    }),
  );
}

/** Lo que depende del modo y sus flags (paleta, paneles). Crece con los commits siguientes. */
function onModeVisualsChanged(): void {
  renderColour();
}

function applyMode(id: string, fromUser: boolean): void {
  const m = getMode(id);
  params.mode = m.id;
  if (fromUser) {
    if (m.defaultPair) {
      params.pair = getPair(m.defaultPair).id;
      params.invert = false;
    }
    if (m.style && (STYLES as readonly string[]).includes(m.style)) {
      params.style = m.style as Style;
      styleSeg.set(params.style);
    }
    for (const [k, v] of Object.entries(m.paint ?? {})) {
      (params as unknown as Record<string, DialValue>)[k] = v;
      if (typeof v === 'number') controls[k]?.set(v);
    }
    time = 0;
    renderer.resetSmear();
    brush.reset();
    events = [];
    renderTouchStatus();
  }
  const base = m.group === 'Base';
  layerKey = '';
  emptyShare = -1;
  dialsRoot.hidden = base;
  mediaRoot.hidden = !base && !m.dials.some((d) => d.id === 'photo');
  textRoot.hidden = !base;
  dialsHead.textContent = m.label;
  dialControls = buildDials(dialsBody, m.dials, { get: (d) => modeValues(m)[d.id], set: setDial });
  renderModeMeta();
  onModeVisualsChanged();
  save();
}

// Presets: modo + flags + diales (los enlazados incluidos) + texto.
presetSave.addEventListener('click', () => {
  const m = mode();
  const preset = { kind: 'aerosol-preset', version: 1, mode: m.id, flags: params.flags[m.id] ?? [], dials: modeValues(m), text: params.text };
  download(new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' }), `aerosol-preset-${m.id}.json`).catch((e) =>
    console.error(e),
  );
});
presetLoad.addEventListener('click', () => presetInput.click());
presetInput.addEventListener('change', async () => {
  const f = presetInput.files?.[0];
  presetInput.value = '';
  if (!f) return;
  try {
    const p = JSON.parse(await f.text());
    if (p?.kind !== 'aerosol-preset' || !MODES.some((m) => m.id === p.mode)) throw new Error('not an Aerosol preset');
    const m = getMode(p.mode);
    params.flags[m.id] = Array.isArray(p.flags) ? p.flags.filter((x: unknown) => m.optionalUnlocked.some((o) => o.id === x)) : [];
    for (const d of m.dials) {
      const v = p.dials?.[d.id];
      if (v === undefined) continue;
      if (d.bind) (params as unknown as Record<string, DialValue>)[d.bind] = v;
      else (params.dials[m.id] ??= {})[d.id] = v;
      if (d.bind && typeof v === 'number') controls[d.bind]?.set(v);
    }
    if (typeof p.text === 'string') {
      params.text = p.text;
      textarea.value = p.text;
      refreshText();
    }
    applyMode(m.id, false);
    time = 0;
  } catch (e) {
    modeMeta.append(el('span', { class: 'error' }, `Could not load preset: ${e instanceof Error ? e.message : e}`));
  }
});

const frameBody = section(right, 'Frame');
segmented(frameBody, Object.keys(FRAMES) as FrameKey[], params.frame, (v) => {
  params.frame = v;
  refreshText();
  fitCanvas();
  save();
});

const colourBody = section(right, 'Colour');
const pairSwatches = el('div', { class: 'pair-swatches' });
const pairLabel = el('span', { class: 'pair-label' });
const skipPair = el('button', { class: 'btn small', type: 'button', title: 'Next locked pair' }, 'Skip pair');
const invertPair = el('button', { class: 'btn small', type: 'button', title: 'Swap field and figure' }, 'Invert');
colourBody.append(el('div', { class: 'pair-row' }, pairSwatches, pairLabel, el('span', { class: 'pair-actions' }, skipPair, invertPair)));
skipPair.addEventListener('click', () => {
  params.pair = nextPair(params.pair).id;
  onModeVisualsChanged();
  save();
});
invertPair.addEventListener('click', () => {
  params.invert = !params.invert;
  onModeVisualsChanged();
  save();
});
const fullPaletteBox = el('div', { class: 'section-body' });
const tabSeg = segmented<Tab>(
  fullPaletteBox,
  [
    { value: 'photo', label: 'Photo' },
    { value: 'brand', label: BRAND_NAME },
  ],
  params.tab,
  (v) => {
    params.tab = v;
    renderColour();
    save();
  },
);
const swatches = el('div', { class: 'swatches' });
fullPaletteBox.append(swatches);
colourBody.append(fullPaletteBox);
const presetSeg = segmented<PresetName | ''>(fullPaletteBox, PRESET_NAMES, params.preset[params.tab] ?? '', (v) => {
  if (!v) return;
  params.preset[params.tab] = v;
  params.active[params.tab] = null;
  renderColour();
  save();
}, 'flat');
numSlider(fullPaletteBox, 'brandMix', 'Brand mix', 0, 1, 0.01, 2);
const lockedNote = el('p', { class: 'note' }, 'Two inks only: Brand mix is fixed at 1. Turn on the full palette under Mode to use photo colours.');
colourBody.append(lockedNote);

function renderColour(): void {
  const ink = inks();
  pairSwatches.replaceChildren(
    ...[ink.field, ink.figure].map((c, i) => {
      const sw = el('span', { class: 'swatch', title: `${i ? 'Figure' : 'Field'} ${rgbToHex(c)}` });
      sw.style.background = rgbToHex(c);
      return sw;
    }),
  );
  pairLabel.replaceChildren(ink.label + (params.invert ? ' · inverted' : ''), ...(ink.unlocked ? [el('em', {}, ' · fuera de pares locked')] : []));
  skipPair.disabled = ink.unlocked;
  const locked = lockedPalette();
  fullPaletteBox.hidden = locked;
  lockedNote.hidden = !locked || !isBase();
  tabSeg.set(params.tab);
  presetSeg.set(params.active[params.tab] ? '' : (params.preset[params.tab] ?? 'Full'));
  const pal = palette();
  const on = new Set(activeIdx());
  swatches.replaceChildren(
    ...pal.colors.map((c, i) => {
      const b = el('button', {
        class: `swatch${on.has(i) ? '' : ' off'}`,
        type: 'button',
        title: `${pal.names[i]} · click to toggle`,
        'aria-pressed': String(on.has(i)),
      });
      b.style.background = rgbToHex(c);
      b.addEventListener('click', () => {
        const next = new Set(activeIdx());
        if (next.has(i)) next.delete(i);
        else next.add(i);
        params.active[params.tab] = [...next].sort((x, y) => x - y);
        renderColour();
        save();
      });
      return b;
    }),
  );
  const sel = params.textColor[params.tab] >= 0 && params.textColor[params.tab] < pal.colors.length ? params.textColor[params.tab] : pal.text;
  textSwatches.replaceChildren(
    ...pal.colors.map((c, i) => {
      const b = el('button', { class: `swatch${i === sel ? ' sel' : ''}`, type: 'button', title: `Text: ${pal.names[i]}` });
      b.style.background = rgbToHex(c);
      b.addEventListener('click', () => {
        params.textColor[params.tab] = i;
        renderColour();
        save();
      });
      return b;
    }),
  );
}

const paintBody = section(right, 'Paint');
const styleSeg = segmented<Style>(
  paintBody,
  [
    { value: 'spray', label: 'Spray' },
    { value: 'halftone', label: 'Dots' },
    { value: 'riso', label: 'Riso' },
    { value: 'pixel', label: 'Pixel' },
    { value: 'lines', label: 'Lines' },
  ],
  params.style,
  (v) => {
    params.style = v;
    save();
  },
);
numSlider(paintBody, 'flatten', 'Flatten', 2, 12, 1);
numSlider(paintBody, 'airbrush', 'Airbrush', 0, 12, 0.05, 2);
numSlider(paintBody, 'grain', 'Grain', 0, 50, 1);
numSlider(paintBody, 'saturation', 'Saturation', 0, 2.5, 0.01, 2);
numSlider(paintBody, 'pale', 'Pale ground', 0, 1, 0.01, 2);
numSlider(paintBody, 'boil', 'Boil', 0, 3, 0.01, 2);

const fxBody = section(right, 'Effects', 'stack on any style');
numSlider(fxBody, 'wave', 'Wave', 0, 1, 0.01, 2);
numSlider(fxBody, 'glass', 'Glass', 0, 1, 0.01, 2);
numSlider(fxBody, 'chroma', 'Chroma', 0, 1, 0.01, 2);
numSlider(fxBody, 'glow', 'Glow', 0, 1, 0.01, 2);

const motionBody = section(right, 'Motion');
numSlider(motionBody, 'hold', 'Hold', 0.5, 8, 0.1, 1, 's');
numSlider(motionBody, 'fade', 'Fade', 0, 3, 0.1, 1, 's');

const resetBody = section(right, 'Reset');
const resetAll = el('button', { class: 'link', type: 'button' }, 'Restore all defaults');
resetAll.addEventListener('click', () => {
  const keep = { text: params.text };
  Object.assign(params, structuredClone(DEFAULTS), keep);
  for (const [k, c] of Object.entries(controls)) c.set(params[k as NumKey]);
  save();
  location.reload();
});
resetBody.append(resetAll);

// Header: resolución
segmented(document.querySelector<HTMLElement>('#res')!, ['720p', '1080p'] as const, params.res, (v) => {
  params.res = v;
  refreshText();
  fitCanvas();
  save();
});

// ---------------------------------------------------------------- Layout del canvas

const viewport = document.querySelector<HTMLElement>('#viewport')!;
function fitCanvas(): void {
  const [w, h] = frameSize();
  const pad = 56;
  const aw = Math.max(50, viewport.clientWidth - pad);
  const ah = Math.max(50, viewport.clientHeight - pad);
  const s = Math.min(aw / w, ah / h);
  canvas.style.width = `${Math.floor(w * s)}px`;
  canvas.style.height = `${Math.floor(h * s)}px`;
}
new ResizeObserver(fitCanvas).observe(viewport);

// ---------------------------------------------------------------- Arranque

media.push(fromCanvas('sample-portrait', portrait()), fromCanvas('sample-bloom', bloom()));
refreshPhotoPalette();
renderMedia();
renderColour();
renderTouchStatus();
applyMode(params.mode, false);
setPlaying(true);
fitCanvas();
refreshText();
loadBrandFont().then(() => {
  refreshText();
  layerKey = '';
});
requestAnimationFrame(loop);

// Para pruebas automáticas.
Object.assign(window, {
  __aerosol: {
    params,
    setTime: (t: number) => (time = t),
    applyMode,
    setPlaying,
    renderNow: () => draw(0),
    refresh: () => {
      refreshText();
      renderColour();
      fitCanvas();
    },
  },
});
