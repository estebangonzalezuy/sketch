import "./styles.css";
import { DEFAULT_PALETTE, PALETTES, type PaletteId } from "./palettes";
import { FPS, MODE_PLATE, type AppState, type Dials, type ModeId, type Project, type ViewId } from "./types";
import { loadProject } from "./engine/project";
import { clearScene, renderMode } from "./modes/render";
import { canEncodeAvc, exportMp4 } from "./exportMp4";
import { mountPanel, setExportStatus, syncPanel } from "./ui";

const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const ctx = canvas.getContext("2d", { alpha: false })!;
const video = document.querySelector<HTMLVideoElement>("#plate")!;
const panel = document.querySelector<HTMLElement>("#panel")!;

const state: AppState = {
  mode: "trayectorias",
  view: "footage",
  palette: DEFAULT_PALETTE.trayectorias,
  dials: { tamaño: 0.5, ritmo: 0.45, cantidad: 0.85 },
  playing: false,
  frame: 0,
};

let project: Project | null = null;
let raf = 0;
let rvfc = 0;
let lastAbs = 0;
let ready = false;

function duration(): number {
  return project ? project.nFrames / project.fps : 0;
}

function time(): number {
  return state.frame / (project?.fps ?? FPS);
}

async function setPlate(src: string) {
  if (video.getAttribute("data-src") === src && video.readyState >= 2) return;
  video.pause();
  await new Promise<void>((resolve, reject) => {
    const on = () => {
      video.removeEventListener("loadeddata", on);
      video.removeEventListener("error", err);
      resolve();
    };
    const err = () => {
      video.removeEventListener("loadeddata", on);
      video.removeEventListener("error", err);
      reject(new Error("no se pudo cargar el footage"));
    };
    video.addEventListener("loadeddata", on);
    video.addEventListener("error", err);
    video.src = src;
    video.setAttribute("data-src", src);
    video.load();
  });
}

export async function seekFrame(f: number): Promise<void> {
  if (!project) return;
  const fps = project.fps;
  const max = project.nFrames - 1;
  const frame = Math.max(0, Math.min(max, Math.round(f)));
  state.frame = frame;
  if (state.view === "canvas") return;
  const t = Math.min(Math.max(0, (frame + 0.5) / fps), Math.max(0, video.duration - 0.001));
  if (video.readyState < 2) return;
  if (Math.abs(video.currentTime - t) < 1 / (fps * 2) && !video.seeking) return;
  await new Promise<void>((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.currentTime = t;
  });
}

function paint() {
  if (!project) return;
  const pal = PALETTES[state.palette];
  clearScene(ctx, state.view, pal, video);
  renderMode({
    ctx,
    project,
    mode: state.mode,
    view: state.view,
    palette: pal,
    dials: state.dials,
    frame: state.frame,
    time: time(),
  });
  syncPanel(panel, state, duration());
}

async function loadMode(mode: ModeId, resetPalette = true) {
  const meta = MODE_PLATE[mode];
  state.mode = mode;
  if (resetPalette) state.palette = DEFAULT_PALETTE[mode];
  project = await loadProject(meta.tracks);
  await setPlate(`/footage/${project.plate}`);
  state.frame = Math.min(state.frame, project.nFrames - 1);
  if (state.view === "footage") await seekFrame(state.frame);
  paint();
}

function play() {
  if (!project) return;
  if (state.frame >= project.nFrames - 1) state.frame = 0;
  state.playing = true;
  lastAbs = 0;
  syncPanel(panel, state, duration());
  const step = (now: number) => {
    if (!state.playing || !project) return;
    if (!lastAbs) lastAbs = now;
    const dt = (now - lastAbs) / 1000;
    lastAbs = now;
    let t = time() + dt;
    if (t >= duration()) {
      t = duration();
      state.frame = project.nFrames - 1;
      state.playing = false;
      if (state.view === "footage") video.pause();
      paint();
      return;
    }
    state.frame = Math.min(project.nFrames - 1, Math.round(t * project.fps));
    if (state.view === "footage" && "requestVideoFrameCallback" in video) {
      // keep video in sync; paint on rvfc
      if (video.paused) {
        video.currentTime = Math.min(video.duration - 0.001, t);
        void video.play();
      }
    } else if (state.view === "footage") {
      video.currentTime = Math.min(video.duration - 0.001, t);
    }
    paint();
    raf = requestAnimationFrame(step);
  };
  if (state.view === "footage") {
    video.currentTime = Math.min(video.duration - 0.001, time());
    void video.play();
    if ("requestVideoFrameCallback" in video) {
      const onFrame: VideoFrameRequestCallback = (_now, meta) => {
        if (!state.playing || !project) return;
        const media = meta.mediaTime;
        state.frame = Math.max(0, Math.min(project.nFrames - 1, Math.round(media * project.fps)));
        if (state.frame >= project.nFrames - 1) {
          state.playing = false;
          video.pause();
          paint();
          return;
        }
        paint();
        rvfc = video.requestVideoFrameCallback(onFrame);
      };
      rvfc = video.requestVideoFrameCallback(onFrame);
      return;
    }
  }
  raf = requestAnimationFrame(step);
}

function pause() {
  state.playing = false;
  video.pause();
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (rvfc && "cancelVideoFrameCallback" in video) {
    video.cancelVideoFrameCallback(rvfc);
  }
  rvfc = 0;
  syncPanel(panel, state, duration());
}

function togglePlay() {
  if (state.playing) pause();
  else play();
}

async function seekRatio(r: number) {
  if (!project) return;
  const was = state.playing;
  if (was) pause();
  await seekFrame(r * (project.nFrames - 1));
  paint();
}

async function doExport() {
  if (!project) return;
  pause();
  setExportStatus(panel, "preparando…", true);
  const wasFrame = state.frame;
  const wasView = state.view;
  try {
    const ok = await canEncodeAvc();
    if (!ok) {
      setExportStatus(panel, "este browser no puede encodar H.264 (WebCodecs). Probá Chrome.", false);
      return;
    }
    const blob = await exportMp4({
      canvas,
      fps: project.fps,
      nFrames: project.nFrames,
      onProgress: (i, n) => setExportStatus(panel, `exportando ${i}/${n}`, true),
      draw: async (f) => {
        await seekFrame(f);
        paint();
      },
    });
    const name = `live-tags-${state.mode}-${wasView}.mp4`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setExportStatus(panel, `listo · ${name}`, false);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setExportStatus(panel, `error: ${msg}`, false);
    throw e;
  } finally {
    await seekFrame(wasFrame);
    paint();
  }
}

mountPanel(panel, {
  setMode: (m) => {
    pause();
    void loadMode(m, true);
  },
  setView: (v) => {
    state.view = v;
    if (v === "footage") void seekFrame(state.frame).then(paint);
    else {
      video.pause();
      paint();
    }
  },
  setPalette: (p) => {
    state.palette = p;
    paint();
  },
  setDial: (k, v) => {
    state.dials[k] = v;
    paint();
  },
  togglePlay,
  seekRatio: (r) => void seekRatio(r),
  exportMp4: () => void doExport(),
});

async function boot() {
  await document.fonts.load("700 40px 'Archivo Narrow'");
  await document.fonts.load("500 22px 'Archivo Narrow'");
  await loadMode(state.mode, true);
  ready = true;
  paint();
}

void boot();

/** Hook for demos / Playwright. */
const api = {
  ready: () => ready,
  getState: () => ({ ...state, dials: { ...state.dials }, nFrames: project?.nFrames ?? 0, fps: project?.fps ?? FPS }),
  async configure(partial: Partial<{ mode: ModeId; view: ViewId; palette: PaletteId; dials: Partial<Dials>; frame: number }>) {
    if (partial.mode && partial.mode !== state.mode) {
      await loadMode(partial.mode, !partial.palette);
    }
    if (partial.view) state.view = partial.view;
    if (partial.palette) state.palette = partial.palette;
    if (partial.dials) state.dials = { ...state.dials, ...partial.dials };
    if (partial.frame !== undefined) await seekFrame(partial.frame);
    else if (state.view === "footage") await seekFrame(state.frame);
    paint();
  },
  seekFrame: (f: number) => seekFrame(f).then(() => paint()),
  paint,
  canvas,
  async exportBlob(): Promise<ArrayBuffer> {
    if (!project) throw new Error("no project");
    pause();
    const blob = await exportMp4({
      canvas,
      fps: project.fps,
      nFrames: project.nFrames,
      draw: async (f) => {
        await seekFrame(f);
        paint();
      },
    });
    return blob.arrayBuffer();
  },
  async framePng(f: number): Promise<string> {
    await seekFrame(f);
    paint();
    return canvas.toDataURL("image/png");
  },
  async frameJpegRange(start: number, end: number, quality = 0.92): Promise<string[]> {
    const out: string[] = [];
    for (let f = start; f < end; f++) {
      await seekFrame(f);
      paint();
      out.push(canvas.toDataURL("image/jpeg", quality));
    }
    return out;
  },
};

declare global {
  interface Window {
    __liveTags: typeof api;
  }
}
window.__liveTags = api;
