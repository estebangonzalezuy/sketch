import { PhysarumSim, type SimParams } from "./sim";
import { merc, frameFor, metersPerUnit, type BBox } from "./geo";
import { PAIRS, pairColors, hexToRgb01 } from "./palettes";
import { computeMetrics, mst, type MetricResult } from "./metrics";
import { exportMp4 } from "./exportMp4";

// ---------- tipos de datos ----------
interface Station { name: string; lat: number; lon: number; lines: string[] }
interface Line { ref: string; name: string; colour: string; ways: [number, number][][] }
interface City {
  id: string; label: string; source: string;
  counts: { raw_station_elements: number; after_line_filter: number; merged_stations: number; lines: number; known?: { stations: number; note: string } };
  stationsBBoxMerc: BBox; region: BBox;
  stations: Station[]; lines: Line[];
  satellite?: { file: string; attribution: string; size: [number, number] };
  overpass?: { fetched?: string };
}

type Layout = "lado" | "mapa" | "canvas" | "apilado";
type Base = "color" | "gris" | "duotono";

interface State extends SimParams {
  city: string; layout: Layout; base: Base; veil: number;
  pair: number; invert: boolean;
  showReal: boolean; showStations: boolean; showLabels: boolean; showMetric: boolean;
  stepsPerFrame: number; expo: number; gamma: number; cell: number; dither: boolean;
  tolM: number; metricEvery: number; duration: number;
}

const DEFAULT: State = {
  city: "barcelona", layout: "lado", base: "color", veil: 0.25,
  pair: Math.floor(Math.random() * PAIRS.length), invert: false,
  showReal: true, showStations: true, showLabels: true, showMetric: true,
  agents: 140_000, sensorAngle: 45, turnAngle: 45, sensorDist: 9, stepSize: 1,
  deposit: 3, decay: 0.1, diffuse: 1, food: 400, foodRadius: 2, spawn: "estaciones", spawnRadius: 3, seed: 1729, respawn: 0.005, leash: 0.06,
  stepsPerFrame: 3, expo: 10, gamma: 1, cell: 2, dither: true,
  tolM: 250, metricEvery: 30, duration: 9,
};
const RESET_KEYS: (keyof State)[] = ["city", "layout", "agents", "foodRadius", "spawn", "spawnRadius", "seed", "leash"];
const SIM_SCALE = 2 / 3;
const FPS = 30;

const S: State = { ...DEFAULT };
const stage = document.getElementById("stage") as HTMLCanvasElement;
const ctx = stage.getContext("2d")!;
const sim = new PhysarumSim();
const cities = new Map<string, City>();
const sats = new Map<string, HTMLImageElement>();
let city!: City;
let frame = 0;
let playing = true;
let metric: MetricResult | null = null;
let busy = false;
let geom = { pw: 1080, ph: 1350, panels: [] as { x: number; y: number; kind: "mapa" | "canvas" }[], frame: [0, 0, 1, 1] as BBox, simW: 720, simH: 900 };
let stationsPx: [number, number][] = []; // en px de simulación
let realPx: [number, number][][] = [];
let duoCache: { key: string; c: HTMLCanvasElement } | null = null;

// ---------- datos ----------
async function loadCity(id: string): Promise<City> {
  if (cities.has(id)) return cities.get(id)!;
  const c = (await (await fetch(`/cities/${id}.json`)).json()) as City;
  cities.set(id, c);
  if (c.satellite) {
    const img = new Image();
    img.src = `/cities/${c.satellite.file}`;
    await img.decode();
    sats.set(id, img);
  }
  return c;
}

function layoutGeom(l: Layout) {
  if (l === "lado") return { W: 2160, H: 1350, pw: 1080, ph: 1350, panels: [{ x: 0, y: 0, kind: "mapa" as const }, { x: 1080, y: 0, kind: "canvas" as const }] };
  if (l === "apilado") return { W: 1080, H: 1350, pw: 1080, ph: 675, panels: [{ x: 0, y: 0, kind: "mapa" as const }, { x: 0, y: 675, kind: "canvas" as const }] };
  return { W: 1080, H: 1350, pw: 1080, ph: 1350, panels: [{ x: 0, y: 0, kind: l as "mapa" | "canvas" }] };
}

function toPanel(lat: number, lon: number, f: BBox, w: number, h: number): [number, number] {
  const [x, y] = merc(lat, lon);
  return [((x - f[0]) / (f[2] - f[0])) * w, ((y - f[1]) / (f[3] - f[1])) * h];
}

async function resetAll() {
  city = await loadCity(S.city);
  const L = layoutGeom(S.layout);
  stage.width = L.W; stage.height = L.H;
  const f = frameFor(city.stationsBBoxMerc, L.pw / L.ph);
  const simW = Math.round(L.pw * SIM_SCALE), simH = Math.round(L.ph * SIM_SCALE);
  geom = { pw: L.pw, ph: L.ph, panels: L.panels, frame: f, simW, simH };
  stationsPx = city.stations.map((s) => toPanel(s.lat, s.lon, f, simW, simH));
  realPx = city.lines.flatMap((ln) => ln.ways.map((w) => w.map(([la, lo]) => toPanel(la, lo, f, simW, simH))));
  sim.reset(simW, simH, stationsPx, S);
  frame = 0; metric = null;
  render();
}

function mPerSimPx() {
  const midLat = (city.stations.reduce((a, s) => a + s.lat, 0) / city.stations.length);
  return ((geom.frame[2] - geom.frame[0]) * metersPerUnit(midLat)) / geom.simW;
}

function measure(): MetricResult {
  const mpp = mPerSimPx();
  metric = computeMetrics({
    trail: sim.readTrail(), W: sim.W, H: sim.H, step: sim.step,
    scale: S.expo, gamma: S.gamma, thr: 0.5,
    tolPx: Math.max(1, Math.round(S.tolM / mpp)), tolM: S.tolM, mPerPx: mpp,
    real: realPx, stations: stationsPx,
  });
  return metric;
}

// ---------- render ----------
function duotone(img: HTMLImageElement, fg: string, bg: string) {
  const key = `${img.src}|${fg}|${bg}`;
  if (duoCache?.key === key) return duoCache.c;
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const A = hexToRgb01(fg), B = hexToRgb01(bg);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.min(1, (0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2]) / 255 * 1.15) * 0.5;
    d.data[i] = (B[0] + (A[0] - B[0]) * v) * 255;
    d.data[i + 1] = (B[1] + (A[1] - B[1]) * v) * 255;
    d.data[i + 2] = (B[2] + (A[2] - B[2]) * v) * 255;
  }
  g.putImageData(d, 0, 0);
  duoCache = { key, c };
  return c;
}

function drawBase(kind: "mapa" | "canvas", fg: string, bg: string) {
  const { pw, ph, frame: f } = geom;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, pw, ph);
  if (kind !== "mapa") return;
  const img = sats.get(city.id);
  if (!img) return;
  const r = city.region;
  const sx = ((f[0] - r[0]) / (r[2] - r[0])) * img.naturalWidth, sy = ((f[1] - r[1]) / (r[3] - r[1])) * img.naturalHeight;
  const sw = ((f[2] - f[0]) / (r[2] - r[0])) * img.naturalWidth, sh = ((f[3] - f[1]) / (r[3] - r[1])) * img.naturalHeight;
  ctx.save();
  if (S.base === "duotono") ctx.drawImage(duotone(img, fg, bg), sx, sy, sw, sh, 0, 0, pw, ph);
  else {
    if (S.base === "gris") ctx.filter = "grayscale(1) contrast(1.15)";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, pw, ph);
    ctx.filter = "none";
    if (S.veil > 0) { ctx.globalAlpha = S.veil; ctx.fillStyle = bg; ctx.fillRect(0, 0, pw, ph); ctx.globalAlpha = 1; }
  }
  ctx.restore();
}

function drawReal(kind: "mapa" | "canvas", fg: string, bg: string) {
  const k = geom.pw / geom.simW;
  const path = new Path2D();
  for (const p of realPx) {
    if (p.length < 2) continue;
    path.moveTo(p[0][0] * k, p[0][1] * k);
    for (let i = 1; i < p.length; i++) path.lineTo(p[i][0] * k, p[i][1] * k);
  }
  ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
  void kind;
  ctx.strokeStyle = bg; ctx.lineWidth = 5; ctx.stroke(path);
  ctx.strokeStyle = fg; ctx.lineWidth = 1.75; ctx.stroke(path);
  ctx.restore();
}

function drawStations(fg: string, bg: string) {
  const k = geom.pw / geom.simW, s = 6;
  ctx.save();
  for (const [x, y] of stationsPx) {
    ctx.fillStyle = bg; ctx.fillRect(x * k - s / 2 - 1.5, y * k - s / 2 - 1.5, s + 3, s + 3);
    ctx.fillStyle = fg; ctx.fillRect(x * k - s / 2, y * k - s / 2, s, s);
  }
  ctx.restore();
}

function textBox(txt: string, x: number, y: number, size: number, weight: number, fg: string, bg: string | null, align: "left" | "right" = "left") {
  ctx.font = `${weight} ${size}px "Archivo Narrow"`;
  const w = ctx.measureText(txt).width, padX = size * 0.3, padY = size * 0.18;
  const x0 = align === "left" ? x : x - w - 2 * padX;
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(x0, y, w + 2 * padX, size + 2 * padY); }
  ctx.fillStyle = fg; ctx.textBaseline = "top";
  ctx.fillText(txt, x0 + padX, y + padY + size * 0.02);
  return size + 2 * padY;
}

function drawLabels(kind: "mapa" | "canvas", fg: string, bg: string) {
  const { pw, ph } = geom;
  const box = kind === "mapa" ? bg : null;
  const tc = kind === "mapa" ? fg : fg;
  const m = 28, sc = ph < 1000 ? 0.75 : 1;
  let y = m;
  y += textBox(city.label, m, y, 46 * sc, 700, tc, box) + 4;
  y += textBox(`${city.stations.length} estaciones · ${city.lines.length} líneas · paso ${sim.step}`, m, y, 22 * sc, 500, tc, box) + 4;
  textBox(kind, pw - m, m, 22 * sc, 500, tc, box, "right");
  let yb = ph - m - 18 * sc - 8;
  const credit = kind === "mapa" && city.satellite ? `© OpenStreetMap contributors · Esri World Imagery` : `© OpenStreetMap contributors`;
  textBox(credit, m, yb, 16 * sc, 400, tc, box);
  if (S.showMetric && metric) {
    const pc = (v: number) => `${Math.round(v * 100)} %`;
    yb -= 30 * sc;
    textBox(`MST mismas estaciones: cobertura ${pc(metric.mstRecall)} · precisión ${pc(metric.mstPrecision)} · ${Math.round(metric.mstLengthKm)} km`, m, yb, 18 * sc, 400, tc, box);
    yb -= 30 * sc;
    textBox(`moho: cobertura ${pc(metric.recall)} · precisión ${pc(metric.precision)} · ${Math.round(metric.mossLengthKm)} km · ${metric.connected}/${metric.stations} conectadas`, m, yb, 18 * sc, 500, tc, box);
    yb -= 30 * sc;
    textBox(`red real ${Math.round(metric.realLengthKm)} km · tolerancia ${metric.tolM} m · medido en paso ${metric.step}`, m, yb, 18 * sc, 400, tc, box);
  }
}

function render() {
  const { fg, bg } = pairColors(S.pair, S.invert);
  sim.display(geom.pw, geom.ph, hexToRgb01(fg), S.expo, S.gamma, S.cell, S.dither ? 0 : 1);
  ctx.save();
  ctx.fillStyle = bg; ctx.fillRect(0, 0, stage.width, stage.height);
  for (const p of geom.panels) {
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.beginPath(); ctx.rect(0, 0, geom.pw, geom.ph); ctx.clip();
    drawBase(p.kind, fg, bg);
    ctx.drawImage(sim.canvas, 0, 0, geom.pw, geom.ph);
    if (S.showReal) drawReal(p.kind, fg, bg);
    if (S.showStations) drawStations(fg, bg);
    if (S.showLabels) drawLabels(p.kind, fg, bg);
    ctx.restore();
  }
  if (geom.panels.length === 2) { // separador de 2 px en el color de figura
    ctx.fillStyle = fg;
    if (S.layout === "lado") ctx.fillRect(geom.pw - 1, 0, 2, stage.height); else ctx.fillRect(0, geom.ph - 1, stage.width, 2);
  }
  ctx.restore();
}

/** Avanza un cuadro: pasos de simulación + medición si toca. */
function advance() {
  sim.run(S.stepsPerFrame);
  frame++;
  if (S.showMetric && S.metricEvery > 0 && frame % S.metricEvery === 0) measure();
}

function loop() {
  if (playing && !busy) { advance(); render(); updateStatus(); }
  requestAnimationFrame(loop);
}

// ---------- UI ----------
const ui = document.getElementById("ui")!;
const controls: { key: keyof State; set: (v: unknown) => void }[] = [];
let statusEl: HTMLElement;

function section(title: string) { const s = document.createElement("section"); s.innerHTML = `<p>${title}</p>`; ui.appendChild(s); return s; }
function slider(parent: HTMLElement, key: keyof State, label: string, min: number, max: number, step: number, fmt = (v: number) => String(v)) {
  const l = document.createElement("label");
  l.innerHTML = `<span>${label}</span><input type=range min=${min} max=${max} step=${step}><span class=val></span>`;
  const inp = l.querySelector("input")!, val = l.querySelector(".val")!;
  const set = (v: unknown) => { inp.value = String(v); val.textContent = fmt(Number(v)); };
  inp.addEventListener("input", () => { val.textContent = fmt(Number(inp.value)); change(key, Number(inp.value)); });
  set(S[key]); parent.appendChild(l); controls.push({ key, set });
}
function select(parent: HTMLElement, key: keyof State, label: string, opts: [string, string][]) {
  const l = document.createElement("label"); l.className = "sel";
  l.innerHTML = `<span>${label}</span><select>${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>`;
  const sel = l.querySelector("select")!;
  const set = (v: unknown) => { sel.value = String(v); };
  sel.addEventListener("change", () => { const v = sel.value; change(key, v === "true" ? true : v === "false" ? false : (key === "pair" ? Number(v) : v)); });
  set(S[key]); parent.appendChild(l); controls.push({ key, set });
}
function button(parent: HTMLElement, txt: string, fn: () => void) { const b = document.createElement("button"); b.textContent = txt; b.onclick = fn; parent.appendChild(b); return b; }

function change(key: keyof State, v: unknown) {
  (S as unknown as Record<string, unknown>)[key] = v;
  if (RESET_KEYS.includes(key)) { void resetAll(); return; }
  sim.setLive({ [key]: v } as Partial<SimParams>);
  if (key === "showMetric" && v) measure();
  render();
}
function syncControls() { for (const c of controls) c.set(S[c.key]); }

async function applyPreset(p: Partial<State>) {
  Object.assign(S, p);
  syncControls();
  await resetAll();
}

async function buildUI() {
  const idx = (await (await fetch("/cities/index.json")).json()) as { id: string; label: string; stations: number }[];
  ui.innerHTML = `<h1>physarum metro</h1><p class=sub>un moho conecta las estaciones reales</p>`;
  const s0 = section("ciudad y vista");
  select(s0, "city", "ciudad", idx.map((c) => [c.id, `${c.label} (${c.stations})`]));
  select(s0, "layout", "vista", [["lado", "mapa | canvas"], ["apilado", "mapa / canvas (4:5)"], ["mapa", "solo mapa"], ["canvas", "solo canvas"]]);
  select(s0, "base", "base mapa", [["color", "satélite color"], ["gris", "satélite gris"], ["duotono", "duotono del par"]]);
  slider(s0, "veil", "velo", 0, 0.8, 0.05, (v) => v.toFixed(2));
  select(s0, "pair", "par", PAIRS.map((p, i) => [String(i), p.label]));
  select(s0, "invert", "invertir", [["false", "no"], ["true", "sí"]]);
  select(s0, "showReal", "red real", [["true", "visible"], ["false", "oculta"]]);
  select(s0, "showStations", "estaciones", [["true", "visibles"], ["false", "ocultas"]]);
  select(s0, "showLabels", "textos", [["true", "sí"], ["false", "no"]]);

  const s1 = section("moho (Jones 2010)");
  slider(s1, "agents", "agentes", 20000, 1000000, 10000, (v) => `${Math.round(v / 1000)}k`);
  slider(s1, "sensorAngle", "ángulo sensor", 5, 90, 0.5, (v) => `${v}°`);
  slider(s1, "turnAngle", "giro", 5, 90, 0.5, (v) => `${v}°`);
  slider(s1, "sensorDist", "dist. sensor", 1, 40, 0.5);
  slider(s1, "stepSize", "velocidad", 0.2, 4, 0.1);
  slider(s1, "deposit", "depósito", 0.5, 30, 0.5);
  slider(s1, "decay", "decaimiento", 0.005, 0.5, 0.005, (v) => v.toFixed(3));
  slider(s1, "diffuse", "difusión", 0, 1, 0.05, (v) => v.toFixed(2));
  slider(s1, "food", "comida", 0, 200, 1);
  slider(s1, "foodRadius", "radio comida", 1, 8, 0.5);
  select(s1, "spawn", "nacen en", [["estaciones", "estaciones"], ["uniforme", "todo el cuadro"]]);
  slider(s1, "leash", "correa", 0, 0.3, 0.01, (v) => (v ? `${Math.round(v * 100)} %` : "no"));
  slider(s1, "respawn", "reaparición", 0, 0.02, 0.0005, (v) => v.toFixed(4));
  slider(s1, "seed", "seed", 1, 9999, 1);
  slider(s1, "stepsPerFrame", "pasos/cuadro", 1, 12, 1);

  const s2 = section("trama");
  slider(s2, "expo", "exposición", 1, 80, 1);
  slider(s2, "gamma", "gamma", 0.3, 3, 0.05, (v) => v.toFixed(2));
  slider(s2, "cell", "celda dither", 1, 4, 1);
  select(s2, "dither", "modo", [["true", "dither 1 bit"], ["false", "umbral"]]);

  const s3 = section("comparación");
  select(s3, "showMetric", "medir", [["true", "sí"], ["false", "no"]]);
  slider(s3, "tolM", "tolerancia", 50, 800, 25, (v) => `${v} m`);
  slider(s3, "metricEvery", "cada (cuadros)", 0, 120, 5);
  button(s3, "medir ahora", () => { measure(); render(); });
  const note = document.createElement("p"); note.className = "note";
  note.innerHTML = "cobertura = parte de la red real con moho a menos de la tolerancia. precisión = parte del moho cerca de la red real. Al lado, lo mismo para el árbol mínimo (MST) de las mismas estaciones, como línea de base.";
  s3.appendChild(note);

  const s4 = section("tiempo y export");
  button(s4, "play / pausa", () => { playing = !playing; });
  button(s4, "reiniciar", () => void resetAll());
  slider(s4, "duration", "duración", 3, 30, 1, (v) => `${v} s`);
  button(s4, "exportar MP4", () => void doExport());
  statusEl = document.createElement("p"); statusEl.className = "note"; s4.appendChild(statusEl);

  const s5 = section("presets");
  const presetNames = ["jones-clasico", "red-fina", "red-gruesa", "lenta-tero"];
  for (const n of presetNames) button(s5, n, async () => applyPreset(await (await fetch(`/presets/${n}.json`)).json()));
  button(s5, "guardar JSON", () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `physarum-${S.city}-${S.seed}.json`; a.click();
  });
  button(s5, "cargar JSON", () => {
    const i = document.createElement("input"); i.type = "file"; i.accept = "application/json";
    i.onchange = async () => { if (i.files?.[0]) await applyPreset(JSON.parse(await i.files[0].text())); }; i.click();
  });

  const s6 = section("teclas");
  s6.insertAdjacentHTML("beforeend", `<p class=note><kbd>espacio</kbd> play · <kbd>r</kbd> reiniciar · <kbd>c</kbd> rotar par · <kbd>i</kbd> invertir · <kbd>v</kbd> vista · <kbd>b</kbd> base · <kbd>l</kbd> red real · <kbd>m</kbd> medir · <kbd>1–6</kbd> ciudad</p>`);
  const s7 = section("fuentes");
  s7.insertAdjacentHTML("beforeend", `<p class=note>Estaciones y líneas: © OpenStreetMap contributors (ODbL), Overpass API. Satélite: Esri World Imagery (Esri, Maxar, Earthstar Geographics) — uso de prototipo; para publicar revisar los términos de Esri. Tokio: homenaje a Tero et al. 2010 (allí era ferrocarril, acá subte).</p>`);
  return idx;
}

function updateStatus() {
  if (statusEl) statusEl.textContent = `cuadro ${frame} · paso ${sim.step}${metric ? ` · métrica en ${metric.ms} ms` : ""}`;
}

async function doExport() {
  busy = true;
  const n = S.duration * FPS;
  try {
    await resetAll();
    const blob = await exportMp4(stage, n, FPS, (i) => { if (i > 0) advance(); render(); }, (i) => { statusEl.textContent = `exportando ${i}/${n}`; });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `physarum-${S.city}-${S.layout}.mp4`; a.click();
  } catch (e) {
    statusEl.textContent = String((e as Error).message || e);
  } finally { busy = false; }
}

let cityIds: string[] = [];
window.addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "SELECT") return;
  const k = e.key.toLowerCase();
  if (k === " ") { playing = !playing; e.preventDefault(); }
  else if (k === "r") void resetAll();
  else if (k === "c") { S.pair = (S.pair + 1) % PAIRS.length; syncControls(); render(); }
  else if (k === "i") { S.invert = !S.invert; syncControls(); render(); }
  else if (k === "v") { const L: Layout[] = ["lado", "apilado", "mapa", "canvas"]; change("layout", L[(L.indexOf(S.layout) + 1) % L.length]); syncControls(); }
  else if (k === "b") { const B: Base[] = ["color", "gris", "duotono"]; S.base = B[(B.indexOf(S.base) + 1) % B.length]; syncControls(); render(); }
  else if (k === "l") { S.showReal = !S.showReal; syncControls(); render(); }
  else if (k === "m") { measure(); render(); }
  else if (/^[1-9]$/.test(k) && cityIds[Number(k) - 1]) { change("city", cityIds[Number(k) - 1]); syncControls(); }
});

// API para grabar demos (scripts/record-demos.mjs)
declare global { interface Window { __physarum: unknown } }
window.__physarum = {
  ready: () => !!city,
  state: () => ({ ...S }),
  apply: async (p: Partial<State>) => { playing = false; await applyPreset(p); },
  pause: () => { playing = false; },
  frames: (n: number) => { for (let i = 0; i < n; i++) advance(); render(); return { frame, step: sim.step }; },
  measure: () => { const m = measure(); render(); return m; },
  metric: () => metric,
  jpeg: (q = 0.93) => stage.toDataURL("image/jpeg", q),
  city: () => ({ id: city.id, label: city.label, counts: city.counts, stations: city.stations.length, lines: city.lines.length, mstEdges: mst(stationsPx).length }),
};

(async () => {
  await document.fonts.load('700 20px "Archivo Narrow"');
  await document.fonts.load('500 20px "Archivo Narrow"');
  await document.fonts.load('400 20px "Archivo Narrow"');
  const idx = await buildUI();
  cityIds = idx.map((c) => c.id);
  await resetAll();
  requestAnimationFrame(loop);
})();
