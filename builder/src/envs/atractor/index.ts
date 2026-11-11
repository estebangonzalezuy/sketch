// 07 Atractor — Clifford / De Jong con morph por un lazo cerrado y densidad 1-bit.
// Función del tiempo: render(t) puro. Densidad estable: misma secuencia de puntos por frame
// (semilla fija), normalización por percentil 99 del frame (sin suavizado temporal: así es
// determinista respecto de t) + curva log + gamma, y dither a 2 colores exactos.
import type { Env, EnvContext } from "../../core/env";
import { ditherTo } from "../../core/dither";
import { font, num } from "../../core/fonts";
import { hexToRgb } from "../../core/palette";
import { mulberry32 } from "../../core/rng";
import { params, type AtractorParams as P } from "./params";
import { presets } from "./presets";

// juegos curados que dan formas (no un punto ni una elipse vacía)
const CURATED: Record<P["tipo"], [number, number, number, number][]> = {
  clifford: [
    [-1.4, 1.6, 1.0, 0.7],
    [1.7, 1.7, 0.6, 1.2],
    [-1.7, 1.3, -0.1, -1.2],
    [-1.7, 1.8, -1.9, -0.4],
    [1.5, -1.8, 1.6, 0.9],
    [-1.8, -2.0, -0.5, -0.9],
  ],
  "de jong": [
    [1.4, -2.3, 2.4, -2.1],
    [2.01, -2.53, 1.61, -0.33],
    [-2.7, -0.09, -0.86, -2.2],
    [-0.827, -1.637, 1.659, -0.943],
    [-2.24, 0.43, -0.65, -2.43],
  ],
};

let hist = new Uint32Array(0);
let vals = new Float32Array(0);
let dens = new Float32Array(0);
let tmp = new Float32Array(0);
let img: ImageData | null = null;
let shuffle = 0;

/** (a,b,c,d) del frame: un lazo cerrado de período `segundos` alrededor de los valores base. */
export function coeffs(t: number, p: P): [number, number, number, number] {
  if (!p.morph.activo || p.morph.amplitud === 0) return [p.a, p.b, p.c, p.d];
  // fase con módulo exacto: el frame T es idéntico al frame 0 (el caos amplifica cualquier error de sin(2π))
  const T = p.morph.segundos;
  const th = 2 * Math.PI * ((((t % T) + T) % T) / T);
  const A = p.morph.amplitud;
  return [p.a + A * Math.sin(th), p.b + A * Math.cos(th), p.c + 0.5 * A * Math.sin(th + 2.1), p.d + 0.5 * A * Math.cos(th + 4.2)];
}

/** centro del bounding box de una pasada corta para un juego (a,b,c,d) */
function bboxCenter(p: P, k: [number, number, number, number], seed: number): [number, number] {
  const [a, b, c, d] = k;
  const rnd = mulberry32(seed ^ 0x5bd1e995);
  let x = rnd() * 2 - 1;
  let y = rnd() * 2 - 1;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const clifford = p.tipo === "clifford";
  for (let i = -100; i < 30000; i++) {
    const nx = clifford ? Math.sin(a * y) + c * Math.cos(a * x) : Math.sin(a * y) - Math.cos(b * x);
    const ny = clifford ? Math.sin(b * x) + d * Math.cos(b * y) : Math.sin(c * x) - Math.cos(d * y);
    x = nx;
    y = ny;
    if (i < 0) continue;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return [(x0 + x1) / 2, (y0 + y1) / 2];
}

/**
 * Centro FIJO de la pieza: promedio del bbox en 8 fases del lazo, cacheado por params.
 * Un centro por frame saltaba ~1 px y desalineaba todo el dither (77 % de la tinta cambiaba por frame).
 */
let centerKey = "";
let center: [number, number] = [0, 0];
function centerOf(p: P, seed: number): [number, number] {
  const key = [p.tipo, p.a, p.b, p.c, p.d, p.morph.activo, p.morph.amplitud, seed].join("|");
  if (key === centerKey) return center;
  const phases = p.morph.activo && p.morph.amplitud > 0 ? 8 : 1;
  let sx = 0, sy = 0;
  for (let i = 0; i < phases; i++) {
    const [x, y] = bboxCenter(p, coeffs((i / phases) * p.morph.segundos, p), seed);
    sx += x;
    sy += y;
  }
  centerKey = key;
  center = [sx / phases, sy / phases];
  return center;
}

function accumulate(w: number, h: number, p: P, k: [number, number, number, number], seed: number, points = p.densidad.puntos) {
  const [a, b, c, d] = k;
  const s = p.render.escala * Math.min(w, h);
  const [mx, my] = centerOf(p, seed);
  // origen en píxel entero: un corrimiento subpíxel también cambia el dither entero
  const cx = Math.round(w / 2 - mx * s);
  const cy = Math.round(h / 2 + my * s);
  // ORBITS órbitas cortas e independientes (no una larga): una sola órbita se queda pegada cerca de
  // ciclos casi periódicos (intermitencia) y un frame salía con la mitad de la tinta. Ver PROCESS.md.
  const rnd = mulberry32(seed);
  const per = Math.max(1, Math.floor(points / ORBITS));
  const clifford = p.tipo === "clifford";
  for (let o = 0; o < ORBITS; o++) {
    let x = rnd() * 2 - 1;
    let y = rnd() * 2 - 1;
    for (let i = -WARMUP; i < per; i++) {
      let nx: number, ny: number;
      if (clifford) {
        nx = Math.sin(a * y) + c * Math.cos(a * x);
        ny = Math.sin(b * x) + d * Math.cos(b * y);
      } else {
        nx = Math.sin(a * y) - Math.cos(b * x);
        ny = Math.sin(c * x) - Math.cos(d * y);
      }
      x = nx;
      y = ny;
      if (i < 0) continue;
      const px = (cx + x * s) | 0;
      const py = (cy - y * s) | 0;
      if (px >= 0 && px < w && py >= 0 && py < h) hist[py * w + px]++;
    }
  }
}

const ORBITS = 256;
const WARMUP = 64;

/**
 * Densidad = cuentas con un kernel de caja 3×3 (estimación de densidad, no blur decorativo).
 * Con ~2 puntos por píxel la cuenta cruda es ruido de Poisson: sin esto, el 82 % de la tinta
 * cambiaba de un frame al siguiente (chispeo). Se mide en PROCESS.md.
 */
function smooth(w: number, h: number) {
  // horizontal
  for (let y = 0; y < h; y++) {
    const r = y * w;
    for (let x = 0; x < w; x++) {
      const i = r + x;
      tmp[i] = hist[i] + (x > 0 ? hist[i - 1] : 0) + (x < w - 1 ? hist[i + 1] : 0);
    }
  }
  // vertical
  for (let y = 0; y < h; y++) {
    const r = y * w;
    for (let x = 0; x < w; x++) {
      const i = r + x;
      dens[i] = (tmp[i] + (y > 0 ? tmp[i - w] : 0) + (y < h - 1 ? tmp[i + w] : 0)) / 9;
    }
  }
}

/** Cuenta del percentil 99 entre píxeles no vacíos, por histograma en escala log (sin ordenar 1,4 M valores). */
function p99(len: number): { p: number; max: number } {
  let max = 0;
  for (let i = 0; i < len; i++) if (dens[i] > max) max = dens[i];
  if (max === 0) return { p: 1, max };
  const B = 2048;
  const buckets = new Uint32Array(B);
  const lm = Math.log1p(max);
  let nz = 0;
  for (let i = 0; i < len; i++) {
    const v = dens[i];
    if (!v) continue;
    nz++;
    buckets[Math.min(B - 1, ((Math.log1p(v) / lm) * B) | 0)]++;
  }
  const target = nz * 0.99;
  let acc = 0;
  for (let b = 0; b < B; b++) {
    acc += buckets[b];
    if (acc >= target) return { p: Math.max(1e-6, Math.expm1(((b + 1) / B) * lm)), max };
  }
  return { p: max, max };
}

/**
 * Exposición de referencia, FIJA en el tiempo: mediana del p99 en 8 fases del lazo (con 1/8 de los
 * puntos cada una, escalado ×8), cacheada por params. El p99 por frame saltaba entre 11 y 168 de un
 * frame al siguiente (el lazo cruza zonas casi periódicas) y la exposición parpadeaba. Suavizarlo con
 * el frame anterior no es determinista; esto sí: depende solo de los params y la semilla.
 */
let refKey = "";
let refValue = 1;
function referenceP99(w: number, h: number, p: P, seed: number): number {
  const key = [w, h, p.tipo, p.a, p.b, p.c, p.d, p.morph.activo, p.morph.amplitud, p.densidad.puntos, p.render.escala, seed].join("|");
  if (key === refKey) return refValue;
  const phases = p.morph.activo && p.morph.amplitud > 0 ? 8 : 1;
  const share = phases;
  const list: number[] = [];
  for (let i = 0; i < phases; i++) {
    hist.fill(0);
    accumulate(w, h, p, coeffs((i / phases) * p.morph.segundos, p), seed, p.densidad.puntos / share);
    smooth(w, h);
    list.push(p99(w * h).p * share);
  }
  list.sort((x, y) => x - y);
  refKey = key;
  refValue = Math.max(1e-6, list[list.length >> 1]);
  return refValue;
}

function draw(g: CanvasRenderingContext2D, t: number, p: P, ctx: EnvContext) {
  const { width: w, height: h } = ctx;
  const len = w * h;
  if (hist.length !== len) {
    hist = new Uint32Array(len);
    vals = new Float32Array(len);
    dens = new Float32Array(len);
    tmp = new Float32Array(len);
    img = null;
  }
  if (!img || img.width !== w || img.height !== h) img = g.createImageData(w, h);
  const P99 = referenceP99(w, h, p, ctx.seed);
  hist.fill(0);
  const k = coeffs(t, p);
  accumulate(w, h, p, k, ctx.seed);
  smooth(w, h);
  const lp = Math.log1p(P99);
  const gamma = p.densidad.gamma;
  for (let i = 0; i < len; i++) {
    const c = dens[i];
    vals[i] = c ? Math.pow(Math.min(1, Math.log1p(c) / lp), gamma) : 0;
  }
  ditherTo(vals, w, h, p.render.dither, p.densidad.umbral, hexToRgb(ctx.palette.bg), hexToRgb(ctx.palette.fg), img.data);
  g.putImageData(img, 0, 0);

  // pie: los 4 números reales del frame
  const m = Math.round(Math.min(w, h) * 0.044);
  g.fillStyle = ctx.palette.fg;
  g.font = font(Math.min(w, h) * 0.02, 400);
  g.textBaseline = "alphabetic";
  g.textAlign = "left";
  g.fillText(`${p.tipo} · a ${num(k[0])} · b ${num(k[1])} · c ${num(k[2])} · d ${num(k[3])}`, m, h - m);
}

/** ¿la forma ocupa algo? (descarta puntos fijos y ciclos cortos) */
function alive(tipo: P["tipo"], k: [number, number, number, number]) {
  const [a, b, c, d] = k;
  const seen = new Set<number>();
  let x = 0.1;
  let y = 0.1;
  for (let i = 0; i < 20000; i++) {
    const nx = tipo === "clifford" ? Math.sin(a * y) + c * Math.cos(a * x) : Math.sin(a * y) - Math.cos(b * x);
    const ny = tipo === "clifford" ? Math.sin(b * x) + d * Math.cos(b * y) : Math.sin(c * x) - Math.cos(d * y);
    x = nx;
    y = ny;
    if (i > 100) seen.add((((x + 3) * 10) | 0) * 64 + (((y + 3) * 10) | 0));
  }
  return seen.size > 250;
}

function curated(rnd: () => number, tipo: P["tipo"]): Partial<P> {
  const list = CURATED[tipo];
  for (let tries = 0; tries < 30; tries++) {
    const base = list[(rnd() * list.length) | 0];
    const j = tries < 20 ? 0.12 : 0;
    const k = base.map((v) => Math.round((v + (rnd() * 2 - 1) * j) * 100) / 100) as [number, number, number, number];
    if (alive(tipo, k)) return { tipo, a: k[0], b: k[1], c: k[2], d: k[3] };
  }
  const k = list[0];
  return { tipo, a: k[0], b: k[1], c: k[2], d: k[3] };
}

const env: Env<P> = {
  id: "atractor",
  num: "07",
  title: "atractor",
  version: "1.0.0",
  category: "sistemas · matemática",
  target: "canvas2d",
  params,
  presets,
  timeline: (p) => ({ duration: p.morph.activo ? p.morph.segundos : 10, loop: p.morph.activo ? "seamless" : "cut", fps: 30 }),
  init: () => {},
  update: () => {},
  render: (target, t, p, ctx) => {
    if (target.kind !== "canvas2d") return;
    draw(target.ctx, t, p, ctx);
  },
  random: (seed, p) => {
    const rnd = mulberry32(seed);
    const tipo = rnd() < 0.6 ? "clifford" : "de jong";
    return { ...curated(rnd, tipo), morph: { ...p.morph, amplitud: Math.round((0.1 + rnd() * 0.35) * 100) / 100 } };
  },
  actions: {
    mezclar: (p, ctx) => ({ params: curated(ctx.prng(1000 + shuffle++), p.tipo) }),
  },
};

export default env;
