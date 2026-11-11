import { DEFAULT_PALETTE, PALETTES, type PaletteId } from "./palettes";
import type { AppState, Dials, ModeId, ViewId } from "./types";

const MODES: { id: ModeId; label: string }[] = [
  { id: "trayectorias", label: "trayectorias" },
  { id: "medidas", label: "medidas" },
  { id: "contador", label: "contador" },
  { id: "atlas", label: "atlas" },
];

export type UiHandlers = {
  setMode: (m: ModeId) => void;
  setView: (v: ViewId) => void;
  setPalette: (p: PaletteId) => void;
  setDial: (k: keyof Dials, v: number) => void;
  togglePlay: () => void;
  seekRatio: (r: number) => void;
  exportMp4: () => void;
};

export function mountPanel(root: HTMLElement, handlers: UiHandlers) {
  root.innerHTML = `
    <div class="brand">live tags</div>
    <div class="block">
      <div class="label">modo</div>
      <div class="row" id="modes"></div>
    </div>
    <div class="block">
      <div class="label">vista</div>
      <div class="row" id="views"></div>
    </div>
    <div class="block">
      <div class="label">paleta</div>
      <div class="swatches" id="palettes"></div>
    </div>
    <div class="block">
      <div class="label">diales</div>
      ${dial("tamaño")}
      ${dial("ritmo")}
      ${dial("cantidad")}
    </div>
    <div class="block">
      <div class="label">tiempo</div>
      <div class="transport">
        <button type="button" id="play">play</button>
        <input type="range" class="timeline" id="timeline" min="0" max="1000" value="0" />
        <div class="clock" id="clock">0.0s</div>
      </div>
    </div>
    <div class="export-row">
      <button type="button" id="export">exportar MP4</button>
      <div id="export-status"></div>
    </div>
  `;

  const modes = root.querySelector("#modes")!;
  for (const m of MODES) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.mode = m.id;
    b.textContent = m.label;
    b.addEventListener("click", () => handlers.setMode(m.id));
    modes.append(b);
  }

  const views = root.querySelector("#views")!;
  for (const v of ["footage", "canvas"] as ViewId[]) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.view = v;
    b.textContent = v;
    b.addEventListener("click", () => handlers.setView(v));
    views.append(b);
  }

  const pals = root.querySelector("#palettes")!;
  for (const p of Object.values(PALETTES)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.dataset.palette = p.id;
    b.title = p.name;
    b.innerHTML = `<i style="background:${p.fg}"></i><i style="background:${p.bg}"></i>`;
    b.addEventListener("click", () => handlers.setPalette(p.id));
    pals.append(b);
  }

  for (const k of ["tamaño", "ritmo", "cantidad"] as (keyof Dials)[]) {
    const input = root.querySelector<HTMLInputElement>(`#dial-${cssId(k)}`)!;
    input.addEventListener("input", () => handlers.setDial(k, Number(input.value) / 100));
  }

  root.querySelector("#play")!.addEventListener("click", () => handlers.togglePlay());
  root.querySelector("#timeline")!.addEventListener("input", (e) => {
    const v = Number((e.target as HTMLInputElement).value) / 1000;
    handlers.seekRatio(v);
  });
  root.querySelector("#export")!.addEventListener("click", () => handlers.exportMp4());
}

function cssId(k: string) {
  return k.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function dial(name: keyof Dials) {
  const id = cssId(name);
  return `<label class="dial">
    <span>${name}</span>
    <input type="range" id="dial-${id}" min="0" max="100" value="50" />
    <em id="val-${id}">0.50</em>
  </label>`;
}

export function syncPanel(root: HTMLElement, state: AppState, duration: number) {
  root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === state.mode);
  });
  root.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === state.view);
  });
  root.querySelectorAll<HTMLButtonElement>("[data-palette]").forEach((b) => {
    b.classList.toggle("active", b.dataset.palette === state.palette);
  });
  for (const [k, v] of Object.entries(state.dials) as [keyof Dials, number][]) {
    const id = cssId(k);
    const input = root.querySelector<HTMLInputElement>(`#dial-${id}`);
    const lab = root.querySelector(`#val-${id}`);
    if (input && document.activeElement !== input) input.value = String(Math.round(v * 100));
    if (lab) lab.textContent = v.toFixed(2);
  }
  const play = root.querySelector("#play")!;
  play.textContent = state.playing ? "pausa" : "play";
  const t = state.frame / 30;
  root.querySelector("#clock")!.textContent = `${t.toFixed(1)}s`;
  const tl = root.querySelector<HTMLInputElement>("#timeline")!;
  if (document.activeElement !== tl && duration > 0) {
    tl.value = String(Math.round((t / duration) * 1000));
  }
  void DEFAULT_PALETTE;
}

export function setExportStatus(root: HTMLElement, text: string, busy = false) {
  const s = root.querySelector("#export-status")!;
  s.textContent = text;
  const b = root.querySelector<HTMLButtonElement>("#export")!;
  b.disabled = busy;
}
