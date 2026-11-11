import { PALETTES, colors, randomParams, randomPendulum, type Axis, type Params } from "./harmono";
import { PRESETS } from "./presets";
import { Renderer, W, H } from "./draw";
import { toSVG } from "./svg";
import { exportMP4 } from "./export";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const panel = document.getElementById("panel")!;
const R = new Renderer();

// paleta al azar al abrir; tecla P rota
let params: Params = structuredClone(PRESETS[0]);
params.palette = Math.floor(Math.random() * PALETTES.length);
let playing = true, t0 = performance.now(), pausedAt = 0;

function apply(rebuild = true) {
  if (rebuild) R.set(params); else { R.p = structuredClone(params); R.last = -1; }
  const c = colors(params);
  document.documentElement.style.setProperty("--bg", c.bg);
  document.documentElement.style.setProperty("--fg", c.fg);
  t0 = performance.now(); pausedAt = 0;
}
function restart() { t0 = performance.now(); pausedAt = 0; R.last = -1; }

function loop() {
  const now = performance.now();
  const el = playing ? (now - t0) / 1000 : pausedAt;
  const time = el % R.loopSeconds();
  R.render(ctx, time);
  requestAnimationFrame(loop);
}

// ---------- UI ----------
function slider(label: string, get: () => number, set: (v: number) => void, min: number, max: number, step: number, rebuild = true) {
  const row = document.createElement("div"); row.className = "row";
  const l = document.createElement("label"); l.textContent = label;
  const r = document.createElement("input"); r.type = "range"; r.min = String(min); r.max = String(max); r.step = String(step); r.value = String(get());
  // número editable: permite ajuste fino (p. ej. frecuencia ±0.001) que el slider no da
  const o = document.createElement("input"); o.type = "number"; o.step = String(step); o.value = fmt(get(), step); o.className = "num";
  r.oninput = () => { set(+r.value); o.value = fmt(+r.value, step); apply(rebuild); };
  o.onchange = () => { const v = +o.value; if (!Number.isFinite(v)) return; set(v); r.value = String(v); apply(rebuild); };
  row.append(l, r, o); return row;
}
const fmt = (v: number, step: number) => v.toFixed(step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step))));
function sec(title: string) { const d = document.createElement("div"); d.className = "sec"; const t = document.createElement("div"); t.className = "t"; t.textContent = title; d.append(t); return d; }
function btn(txt: string, fn: () => void) { const b = document.createElement("button"); b.textContent = txt; b.onclick = fn; return b; }
function msg(s: string) { const m = document.getElementById("msg"); if (m) m.textContent = s; }

function build() {
  panel.innerHTML = "";
  const h = document.createElement("h1"); h.textContent = "harmonógrafo"; panel.append(h);
  const hint = document.createElement("p"); hint.className = "hint";
  hint.textContent = "espacio pausa · r random · p paleta · i invertir · 1–6 presets · s svg · m mp4 · c receta";
  panel.append(hint);

  const sp = sec("preset");
  const sel = document.createElement("select");
  PRESETS.forEach((p, i) => { const o = document.createElement("option"); o.value = String(i); o.textContent = `${i + 1}. ${p.name}`; sel.append(o); });
  sel.value = String(Math.max(0, PRESETS.findIndex(p => p.name === params.name)));
  sel.onchange = () => loadPreset(+sel.value);
  const b1 = document.createElement("div"); b1.className = "btns";
  b1.append(sel, btn("random", randomize), btn("paleta", rotatePalette), btn("invertir", () => { params.invert = !params.invert; apply(false); }));
  sp.append(b1); panel.append(sp);

  const sg = sec("pluma y tiempo");
  sg.append(
    slider("grosor px", () => params.penWidth, v => params.penWidth = v, 0.5, 4, 0.1, false),
    slider("dibujo s", () => params.drawSeconds, v => params.drawSeconds = v, 3, 40, 0.5, false),
    slider("pausa s", () => params.holdSeconds, v => params.holdSeconds = v, 0, 8, 0.5, false),
    slider("t máx", () => params.tEnd, v => params.tEnd = v, 50, 1500, 10),
    slider("corte env.", () => params.cutoff, v => params.cutoff = v, 0.005, 0.3, 0.005),
    slider("margen", () => params.margin, v => params.margin = v, 0, 0.25, 0.01),
  );
  const tm = document.createElement("div"); tm.className = "btns";
  const tsel = document.createElement("select");
  for (const [v, l] of [["fisico", "pluma en tiempo físico (frena)"], ["arco", "pluma a velocidad constante"]]) { const o = document.createElement("option"); o.value = v; o.textContent = l; tsel.append(o); }
  tsel.value = params.timeMode; tsel.onchange = () => { params.timeMode = tsel.value as any; apply(false); };
  tm.append(tsel, btn(params.caption ? "receta: sí" : "receta: no", () => { params.caption = !params.caption; apply(); build(); }));
  sg.append(tm); panel.append(sg);

  const sP = sec(`péndulos (${params.pendulums.length})`);
  sP.append(slider("cantidad", () => params.pendulums.length, v => setCount(v), 2, 6, 1));
  params.pendulums.forEach((q, i) => {
    const d = document.createElement("div"); d.className = "pend";
    const hh = document.createElement("div"); hh.className = "h";
    const s = document.createElement("span"); s.textContent = `péndulo ${i + 1}`;
    const ax = document.createElement("select");
    for (const [v, l] of [["x", "lateral x"], ["y", "lateral y"], ["rot", "mesa rotativa"]]) { const o = document.createElement("option"); o.value = v; o.textContent = l; ax.append(o); }
    ax.value = q.axis; ax.onchange = () => { q.axis = ax.value as Axis; apply(); };
    hh.append(s, ax); d.append(hh);
    d.append(
      slider("frecuencia", () => q.freq, v => q.freq = v, -8, 8, 0.001),
      slider("fase", () => q.phase, v => q.phase = v, 0, 6.28, 0.01),
      slider("amplitud", () => q.amp, v => q.amp = v, 0, 1, 0.01),
      slider("amortig.", () => q.damp, v => q.damp = v, 0, 0.03, 0.0001),
    );
    sP.append(d);
  });
  panel.append(sP);

  const se = sec("presets y export");
  const be = document.createElement("div"); be.className = "btns";
  const file = document.createElement("input"); file.type = "file"; file.accept = "application/json"; file.style.display = "none";
  file.onchange = async () => { const f = file.files?.[0]; if (!f) return; params = JSON.parse(await f.text()); apply(); build(); msg(`cargado ${f.name}`); };
  be.append(btn("guardar json", saveJSON), btn("cargar json", () => file.click()), btn("svg plotter", saveSVG), btn("mp4", doMP4), file);
  se.append(be);
  const m = document.createElement("div"); m.id = "msg"; se.append(m);
  panel.append(se);
}

function setCount(n: number) {
  while (params.pendulums.length < n) params.pendulums.push(randomPendulum(params.pendulums.length));
  params.pendulums.length = n; apply(); build();
}
function loadPreset(i: number) { const pal = params.palette; params = structuredClone(PRESETS[i]); params.palette = pal; apply(); build(); }
function randomize() { params = randomParams(params); apply(); build(); }
function rotatePalette() { params.palette = (params.palette + 1) % PALETTES.length; apply(false); }
function download(name: string, data: BlobPart, type: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const slug = () => params.name.replace(/[^a-z0-9áéíóúñ]+/gi, "-").toLowerCase();
function saveJSON() { download(`${slug()}.json`, JSON.stringify(params, null, 2), "application/json"); }
function saveSVG() { const { svg, points } = toSVG(params, R.path); download(`${slug()}.svg`, svg, "image/svg+xml"); msg(`svg: ${points} puntos`); }
async function doMP4() {
  msg("exportando mp4…");
  const r = await exportMP4(params, s => msg(s));
  if (r.ok) { download(`${slug()}.mp4`, r.data!, "video/mp4"); msg(`mp4 listo (${r.frames} cuadros)`); }
  else msg(r.error!);
}

window.addEventListener("keydown", e => {
  if ((e.target as HTMLElement).tagName === "INPUT" && (e.target as HTMLInputElement).type !== "range") return;
  if (e.key === " ") { e.preventDefault(); if (playing) { pausedAt = (performance.now() - t0) / 1000; playing = false; } else { t0 = performance.now() - pausedAt * 1000; playing = true; } }
  else if (e.key === "r") randomize();
  else if (e.key === "p") rotatePalette();
  else if (e.key === "i") { params.invert = !params.invert; apply(false); }
  else if (e.key === "s") saveSVG();
  else if (e.key === "m") doMP4();
  else if (e.key === "c") { params.caption = !params.caption; apply(); build(); }
  else if (/^[1-6]$/.test(e.key)) loadPreset(+e.key - 1);
});

// API para el render frame a frame (scripts/render.mjs). Mismo Renderer que la preview.
(window as any).__harmono = {
  ready: () => document.fonts.check("34px 'Archivo Narrow'"),
  presets: PRESETS,
  random(seed: number, n = 3) {
    let a = seed >>> 0; const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const base = structuredClone(PRESETS[0]); base.pendulums = base.pendulums.concat([{ axis: "rot", freq: 2, phase: 0, amp: 0.5, damp: 0.003 }]).slice(0, n);
    while (base.pendulums.length < n) base.pendulums.push({ axis: "x", freq: 2, phase: 0, amp: 0.5, damp: 0.003 });
    const r = randomParams(base, rnd); r.name = `random ${seed}`; return r;
  },
  svg(p: Params) { const rr = new Renderer(); rr.set(p); return toSVG(p, rr.path); },
  still(p: Params, time: number) { const rr = new Renderer(); rr.set(p); const off = document.createElement("canvas"); off.width = W; off.height = H; rr.render(off.getContext("2d")!, time); return off.toDataURL("image/png"); },
  frames(p: Params, start: number, end: number, fps: number, q = 0.95) {
    const rr = new Renderer(); rr.set(p);
    const off = document.createElement("canvas"); off.width = W; off.height = H;
    const c2 = off.getContext("2d")!;
    // reproducir desde 0 para que la secuencia de trazos sea idéntica
    const out: string[] = [];
    for (let i = 0; i < end; i++) { rr.render(c2, (i / fps) % rr.loopSeconds()); if (i >= start) out.push(off.toDataURL("image/jpeg", q)); }
    return out;
  },
};

document.fonts.load("34px 'Archivo Narrow'").finally(() => { apply(); build(); loop(); });
