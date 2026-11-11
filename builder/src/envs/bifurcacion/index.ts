// 06 Bifurcación — mapa logístico x → r·x·(1−x). El diagrama se revela de izquierda a derecha con t;
// un punto salta entre las ramas de la órbita del r actual. Función del tiempo.
// El árbol se calcula UNA vez por params (histograma por columna + p99 global + Bayer): las columnas
// ya dibujadas no cambian al seguir el barrido.
import type { Env, EnvContext } from "../../core/env";
import { BAYER4 } from "../../core/dither";
import { font, num } from "../../core/fonts";
import { hexToRgb } from "../../core/palette";
import { mulberry32 } from "../../core/rng";
import { params, type BifurcacionParams as P } from "./params";
import { presets } from "./presets";

const SUB = 4; // valores de r por columna de píxel (densidad)
const HOLD = 1.5; // segundos con el árbol completo antes de volver a empezar

interface Layout {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  m: number;
}

function layout(w: number, h: number): Layout {
  const s = Math.min(w, h);
  const m = Math.round(s * 0.07);
  return { m, x0: m, x1: w - m, y0: Math.round(m + s * 0.17), y1: h - Math.round(m + s * 0.06) };
}

function range(p: P) {
  const r0 = Math.min(p.rango.rMin, p.rango.rMax);
  let r1 = Math.max(p.rango.rMin, p.rango.rMax);
  if (r1 - r0 < 1e-4) r1 = r0 + 1e-4;
  const y0 = Math.min(p.rango.yMin, p.rango.yMax);
  let y1 = Math.max(p.rango.yMin, p.rango.yMax);
  if (y1 - y0 < 1e-4) y1 = y0 + 1e-4;
  return { r0, r1, y0, y1 };
}

// ── árbol cacheado: máscara 1-bit del área del gráfico ──
let treeKey = "";
let tree: Uint8Array = new Uint8Array(0); // 1 = tinta
let treeW = 0;
let treeH = 0;
let img: ImageData | null = null;
let imgKey = "";

function buildTree(p: P, L: Layout, seed: number) {
  const key = JSON.stringify([p.rango, p.barrido.iteraciones, p.barrido.descartar, p.render, L, seed]);
  if (key === treeKey) return;
  treeKey = key;
  imgKey = "";
  const W = L.x1 - L.x0;
  const H = L.y1 - L.y0;
  treeW = W;
  treeH = H;
  const { r0, r1, y0, y1 } = range(p);
  const counts = new Float32Array(W * H);
  const rnd = mulberry32(seed);
  const n = Math.round(p.barrido.iteraciones);
  const skip = Math.round(p.barrido.descartar);
  for (let c = 0; c < W; c++) {
    for (let s = 0; s < SUB; s++) {
      const r = r0 + ((c + (s + 0.5) / SUB) / W) * (r1 - r0);
      let x = 0.2 + rnd() * 0.6;
      for (let i = 0; i < skip; i++) x = r * x * (1 - x);
      for (let i = 0; i < n; i++) {
        x = r * x * (1 - x);
        const yy = (x - y0) / (y1 - y0);
        if (yy < 0 || yy >= 1) continue;
        const row = H - 1 - Math.floor(yy * H);
        counts[row * W + c] += 1;
      }
    }
  }
  // p99 global de las celdas con algo (escala log): fijo para todo el barrido
  const nz: number[] = [];
  for (let i = 0; i < counts.length; i += 3) if (counts[i] > 0) nz.push(counts[i]);
  nz.sort((a, b) => a - b);
  const p99 = nz.length ? nz[Math.min(nz.length - 1, Math.floor(nz.length * 0.99))] : 1;
  const lp = Math.log1p(Math.max(1, p99));
  tree = new Uint8Array(W * H);
  const shift = 0.5 - p.render.umbral;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v0 = counts[y * W + x];
      if (!v0) continue;
      const v = Math.min(1, Math.log1p(v0) / lp);
      tree[y * W + x] = p.render.dither ? (v + shift > BAYER4[(y & 3) * 4 + (x & 3)] ? 1 : 0) : v >= p.render.umbral * 0.6 ? 1 : 0;
    }
  }
}

// ── órbita del r actual: período medido, no escrito ──
function orbit(r: number, skip: number): { values: number[]; label: string; period: number | null } {
  let x = 0.5;
  for (let i = 0; i < Math.max(skip, 600); i++) x = r * x * (1 - x);
  const seq: number[] = [];
  let lyap = 0;
  for (let i = 0; i < 512; i++) {
    x = r * x * (1 - x);
    seq.push(x);
    lyap += Math.log(Math.max(1e-12, Math.abs(r * (1 - 2 * x))));
  }
  lyap /= 512;
  for (let pd = 1; pd <= 64; pd++) {
    let ok = true;
    for (let i = seq.length - 128; i < seq.length - pd; i++) {
      if (Math.abs(seq[i] - seq[i + pd]) > 1e-5) {
        ok = false;
        break;
      }
    }
    if (ok) return { values: seq.slice(seq.length - pd), label: `período ${pd}`, period: pd };
  }
  return { values: seq.slice(seq.length - 64), label: lyap > 0 ? "caos" : "período —", period: null };
}

function rAt(t: number, p: P) {
  const { r0, r1 } = range(p);
  const f = Math.min(1, Math.max(0, t / p.barrido.segundos));
  return { r: r0 + f * (r1 - r0), f };
}

function draw(g: CanvasRenderingContext2D, t: number, p: P, ctx: EnvContext) {
  const { width: w, height: h, palette } = ctx;
  const L = layout(w, h);
  buildTree(p, L, ctx.seed);
  const { r, f } = rAt(t, p);
  const { r0, r1, y0, y1 } = range(p);

  g.fillStyle = palette.bg;
  g.fillRect(0, 0, w, h);

  // árbol revelado hasta el r actual (columnas cacheadas: no cambian)
  const key = `${treeKey}|${palette.bg}|${palette.fg}`;
  if (!img || img.width !== treeW || img.height !== treeH || imgKey !== key) {
    img = new ImageData(treeW, treeH);
    const bg = hexToRgb(palette.bg);
    const fg = hexToRgb(palette.fg);
    for (let i = 0; i < tree.length; i++) {
      const c = tree[i] ? fg : bg;
      img.data[i * 4] = c[0];
      img.data[i * 4 + 1] = c[1];
      img.data[i * 4 + 2] = c[2];
      img.data[i * 4 + 3] = 255;
    }
    imgKey = key;
  }
  const cols = Math.min(treeW, Math.floor(f * treeW));
  if (cols > 0) g.putImageData(img, L.x0, L.y0, 0, 0, cols, treeH);

  const s = Math.min(w, h);
  const xr = L.x0 + Math.min(treeW - 1, Math.floor(f * treeW));
  g.fillStyle = palette.fg;
  // línea del r actual
  g.fillRect(xr, L.y0, Math.max(1, Math.round(s / 540)), treeH);

  // punto que salta entre las ramas (≈6 saltos por segundo)
  const o = orbit(r, p.barrido.descartar);
  const k = Math.floor(t * 6) % o.values.length;
  const yy = (o.values[k] - y0) / (y1 - y0);
  if (yy >= 0 && yy <= 1) {
    const rad = (p.render.punto * s) / 1080;
    g.beginPath();
    g.arc(xr, L.y1 - yy * treeH, rad, 0, Math.PI * 2);
    g.fill();
  }

  // cifra grande: r y período (medidos)
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.font = font(s * 0.075, 700);
  g.fillText(`r = ${num(r, 4)} · ${o.label}`, L.m, L.m + s * 0.075);

  if (p.rótulos) {
    // eje r lineal y rotulado
    const ay = L.y1 + Math.round(s * 0.012);
    g.fillRect(L.x0, ay, treeW, Math.max(1, Math.round(s / 1080)));
    g.font = font(s * 0.02, 400);
    const span = r1 - r0;
    const step = niceStep(span / 5);
    g.textAlign = "center";
    for (let v = Math.ceil(r0 / step) * step; v <= r1 + 1e-9; v += step) {
      const x = L.x0 + ((v - r0) / span) * treeW;
      g.fillRect(Math.round(x), ay, Math.max(1, Math.round(s / 1080)), Math.round(s * 0.01));
      g.fillText(num(v, decimals(step)), x, ay + s * 0.035);
    }
    g.textAlign = "left";
    g.fillText(`x ${num(y1, 2)}`, L.x0, L.y0 - s * 0.012);
    g.fillText("x → r·x·(1 − x)", L.x0, h - L.m * 0.45);
    g.textAlign = "right";
    g.fillText("r", L.x1, h - L.m * 0.45);
  }
}

function niceStep(raw: number) {
  const e = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / e;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e;
}
function decimals(step: number) {
  return Math.max(0, Math.min(4, -Math.floor(Math.log10(step) + 1e-9)));
}

const env: Env<P> = {
  id: "bifurcacion",
  num: "06",
  title: "bifurcación",
  version: "1.0.0",
  category: "sistemas · matemática",
  target: "canvas2d",
  params,
  presets,
  timeline: (p) => ({ duration: p.barrido.segundos + HOLD, loop: "cut", fps: 30 }),
  init: () => {},
  update: () => {},
  render: (target, t, p, ctx) => {
    if (target.kind === "canvas2d") draw(target.ctx, t, p, ctx);
  },
  random: (seed) => {
    const rnd = mulberry32(seed);
    const list = presets.slice(1).map((x) => x.params);
    return list[(rnd() * list.length) | 0];
  },
};

export default env;
