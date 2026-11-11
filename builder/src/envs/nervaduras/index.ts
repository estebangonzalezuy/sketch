// 10 Nervaduras — colonización del espacio (space colonization) dentro de una letra.
// Simulación: reset(seed) muestrea auxinas dentro de la máscara y pone la raíz en la base; step() avanza
// un frente geodésico (BFS en la grilla de la máscara desde la raíz) que activa auxinas, y los nodos
// crecen hacia las auxinas activas. Las venas nunca salen de la máscara. Grosor por modelo de tubería.
import type { Env, EnvContext } from "../../core/env";
import { font } from "../../core/fonts";
import { mulberry32 } from "../../core/rng";
import { params, type NervadurasParams as P } from "./params";
import { presets } from "./presets";

const GROW = 9; // segundos para que el frente recorra la letra con velocidad 1
const HOLD = 1.5;
const CELL = 4; // grilla del BFS (px)
const MAX_NODES = 30000;

let W = 1080;
let H = 1350;
let mask: Uint8Array = new Uint8Array(0); // por píxel
let maskKey = "";
let gw = 0;
let gh = 0;
let geo: Float32Array = new Float32Array(0); // distancia geodésica por celda (px), Infinity fuera
let maxGeo = 1;
let root = { x: 0, y: 0 };
let fontPx = 0;
let textY = 0;

// auxinas
let ax = new Float32Array(0);
let ay = new Float32Array(0);
let ad = new Float32Array(0);
let alive: Uint8Array = new Uint8Array(0);
// nodos
let nx: number[] = [];
let ny: number[] = [];
let par: number[] = [];
let front = 0;

const inMask = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && mask[(y | 0) * W + (x | 0)] === 1;

function buildMask(p: P) {
  const key = `${W}x${H}|${p.letra}`;
  if (key === maskKey) return;
  maskKey = key;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  const letter = [...p.letra.trim()][0] ?? "A";
  // tamaño: que la letra llene el canvas con margen
  fontPx = Math.min(W, H) * 1.1;
  g.font = font(fontPx, 700);
  let m = g.measureText(letter);
  const fit = Math.min((W * 0.82) / Math.max(1, m.width), (H * 0.8) / Math.max(1, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent));
  fontPx *= fit;
  g.font = font(fontPx, 700);
  m = g.measureText(letter);
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  textY = H / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  g.fillStyle = "#ffffff";
  g.fillText(letter, W / 2, textY);
  const d = g.getImageData(0, 0, W, H).data;
  mask = new Uint8Array(W * H);
  for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3] > 128 ? 1 : 0;

  // raíz: celda más baja, la más cercana al centro horizontal
  gw = Math.ceil(W / CELL);
  gh = Math.ceil(H / CELL);
  const cellIn = (i: number, j: number) => inMask(i * CELL + CELL / 2, j * CELL + CELL / 2);
  let best = -1;
  for (let j = gh - 1; j >= 0 && best < 0; j--) {
    let bd = Infinity;
    for (let i = 0; i < gw; i++)
      if (cellIn(i, j) && Math.abs(i * CELL - W / 2) < bd) {
        bd = Math.abs(i * CELL - W / 2);
        best = j * gw + i;
      }
  }
  geo = new Float32Array(gw * gh).fill(Infinity);
  if (best < 0) return;
  root = { x: (best % gw) * CELL + CELL / 2, y: Math.floor(best / gw) * CELL + CELL / 2 };
  // BFS geodésico (8 vecinos, costo euclídeo aproximado con cola por niveles)
  const q = new Int32Array(gw * gh);
  let qh = 0;
  let qt = 0;
  geo[best] = 0;
  q[qt++] = best;
  maxGeo = 1;
  while (qh < qt) {
    const k = q[qh++];
    const i = k % gw;
    const j = (k / gw) | 0;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
        const kk = jj * gw + ii;
        const nd = geo[k] + (di && dj ? 1.4142 : 1) * CELL;
        if (nd < geo[kk] && cellIn(ii, jj)) {
          if (geo[kk] === Infinity) q[qt++] = kk;
          geo[kk] = nd;
          if (nd > maxGeo) maxGeo = nd;
        }
      }
  }
}

function geoAt(x: number, y: number) {
  return geo[Math.min(gh - 1, (y / CELL) | 0) * gw + Math.min(gw - 1, (x / CELL) | 0)];
}

const sc = () => Math.min(W, H) / 1080;

function reset(seed: number, p: P) {
  buildMask(p);
  const rnd = mulberry32(seed);
  const want = Math.round(p.colonización.auxinas);
  const xs: number[] = [];
  const ys: number[] = [];
  const ds: number[] = [];
  let tries = 0;
  while (xs.length < want && tries < want * 60) {
    tries++;
    const x = rnd() * W;
    const y = rnd() * H;
    if (!inMask(x, y)) continue;
    const d = geoAt(x, y);
    if (!Number.isFinite(d)) continue; // parte de la letra no conectada a la raíz
    xs.push(x);
    ys.push(y);
    ds.push(d);
  }
  ax = Float32Array.from(xs);
  ay = Float32Array.from(ys);
  ad = Float32Array.from(ds);
  alive = new Uint8Array(xs.length).fill(1);
  nx = [root.x];
  ny = [root.y];
  par = [-1];
  front = 0;
}

function step(_dt: number, p: P) {
  if (!ax.length) return;
  const k = sc();
  front += (maxGeo / (GROW * 30)) * p.frente.velocidad;
  const R = p.colonización.radioInfluencia * k;
  const kill = p.colonización.radioMuerte * k;
  const stepLen = p.colonización.paso * k;
  // buckets de nodos (celda = radio de influencia)
  const bs = Math.max(4, R);
  const bw = Math.ceil(W / bs) + 1;
  const buckets = new Map<number, number[]>();
  for (let i = 0; i < nx.length; i++) {
    const key = ((ny[i] / bs) | 0) * bw + ((nx[i] / bs) | 0);
    const b = buckets.get(key);
    if (b) b.push(i);
    else buckets.set(key, [i]);
  }
  const dirX = new Map<number, number>();
  const dirY = new Map<number, number>();
  for (let a = 0; a < ax.length; a++) {
    if (!alive[a] || ad[a] > front) continue;
    const bx = (ax[a] / bs) | 0;
    const by = (ay[a] / bs) | 0;
    let best = -1;
    let bd = R * R;
    for (let j = by - 1; j <= by + 1; j++)
      for (let i = bx - 1; i <= bx + 1; i++) {
        const b = buckets.get(j * bw + i);
        if (!b) continue;
        for (const n of b) {
          const d = (nx[n] - ax[a]) ** 2 + (ny[n] - ay[a]) ** 2;
          if (d < bd) {
            bd = d;
            best = n;
          }
        }
      }
    if (best < 0) continue;
    if (bd < kill * kill) {
      alive[a] = 0;
      continue;
    }
    const d = Math.sqrt(bd);
    dirX.set(best, (dirX.get(best) ?? 0) + (ax[a] - nx[best]) / d);
    dirY.set(best, (dirY.get(best) ?? 0) + (ay[a] - ny[best]) / d);
  }
  // crecer (orden de índice: determinista)
  const grow = [...dirX.keys()].sort((a, b) => a - b);
  for (const n of grow) {
    if (nx.length >= MAX_NODES) break;
    const dx = dirX.get(n)!;
    const dy = dirY.get(n)!;
    const l = Math.hypot(dx, dy);
    if (l < 1e-6) continue;
    const x = nx[n] + (dx / l) * stepLen;
    const y = ny[n] + (dy / l) * stepLen;
    if (!inMask(x, y) || !inMask((x + nx[n]) / 2, (y + ny[n]) / 2)) continue; // nunca fuera de la letra
    nx.push(x);
    ny.push(y);
    par.push(n);
  }
}

function widths(p: P): Float32Array {
  const n = nx.length;
  const flow = new Float32Array(n).fill(1);
  for (let i = n - 1; i > 0; i--) flow[par[i]] += flow[i];
  const max = flow[0] || 1;
  const w = new Float32Array(n);
  const base = p.trazo.grosorBase * sc();
  // modelo de tubería (Murray): grosor ∝ flujo^(1/exponente), monótono hacia la raíz
  for (let i = 0; i < n; i++) w[i] = Math.max(0.75, base * Math.pow(flow[i] / max, 1 / p.trazo.exponente));
  return w;
}

function draw(g: CanvasRenderingContext2D, p: P, ctx: EnvContext) {
  const { palette } = ctx;
  g.fillStyle = palette.bg;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = palette.fg;
  g.fillStyle = palette.fg;
  if (p.trazo.mostrarContorno) {
    g.lineWidth = Math.max(1, 1.5 * sc());
    g.font = font(fontPx, 700);
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.strokeText([...p.letra.trim()][0] ?? "A", W / 2, textY);
  }
  const w = widths(p);
  // agrupado por grosor (cuantizado) para dibujar rápido
  const groups = new Map<number, number[]>();
  for (let i = 1; i < nx.length; i++) {
    const q = Math.round(w[i] * 4) / 4;
    const b = groups.get(q);
    if (b) b.push(i);
    else groups.set(q, [i]);
  }
  g.lineCap = "round";
  for (const [q, list] of groups) {
    g.lineWidth = q;
    g.beginPath();
    for (const i of list) {
      g.moveTo(nx[par[i]], ny[par[i]]);
      g.lineTo(nx[i], ny[i]);
    }
    g.stroke();
  }
}

function svg(p: P, ctx: EnvContext) {
  const { palette } = ctx;
  const w = widths(p);
  const groups = new Map<number, string[]>();
  for (let i = 1; i < nx.length; i++) {
    const q = Math.round(w[i] * 4) / 4;
    const s = `M${nx[par[i]].toFixed(1)} ${ny[par[i]].toFixed(1)}L${nx[i].toFixed(1)} ${ny[i].toFixed(1)}`;
    const b = groups.get(q);
    if (b) b.push(s);
    else groups.set(q, [s]);
  }
  const letter = ([...p.letra.trim()][0] ?? "A").replace(/[<>&]/g, "");
  const outline = p.trazo.mostrarContorno
    ? `<text x="${W / 2}" y="${textY.toFixed(1)}" fill="none" stroke="${palette.fg}" stroke-width="${Math.max(1, 1.5 * sc()).toFixed(2)}" font-family="Archivo Narrow" font-weight="700" font-size="${fontPx.toFixed(1)}" text-anchor="middle">${letter}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${palette.bg}"/>
${outline}
<g fill="none" stroke="${palette.fg}" stroke-linecap="round">${[...groups].map(([q, d]) => `<path stroke-width="${q}" d="${d.join("")}"/>`).join("")}</g>
</svg>`;
}

const LETTERS = ["A", "R", "S", "E", "g", "B", "K", "M", "Q", "&"];

const env: Env<P> = {
  id: "nervaduras",
  num: "10",
  title: "nervaduras",
  version: "1.0.0",
  category: "generativo",
  target: "canvas2d",
  inputs: ["text"],
  params,
  presets,
  timeline: (p) => ({ duration: GROW / Math.max(0.1, p.frente.velocidad) + HOLD + 1, loop: "cut", fps: 30 }),
  init: (_t, ctx) => {
    W = ctx.width;
    H = ctx.height;
    maskKey = "";
  },
  update: () => {},
  reset,
  step,
  render: (target, _t, p, ctx) => {
    if (target.kind === "canvas2d") draw(target.ctx, p, ctx);
  },
  random: (seed, p) => {
    const rnd = mulberry32(seed);
    return {
      letra: LETTERS[(rnd() * LETTERS.length) | 0],
      colonización: { ...p.colonización, auxinas: 1500 + Math.round(rnd() * 40) * 100, radioInfluencia: Math.round(25 + rnd() * 50) },
      trazo: { ...p.trazo, grosorBase: Math.round(4 + rnd() * 8) },
    };
  },
  actions: { reiniciar: () => ({ reset: true }) },
  exports: { svg },
};

export default env;
