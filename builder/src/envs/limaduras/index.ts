// 01 Limaduras — limaduras de hierro alineadas por el campo de N dipolos (la palabra son los imanes).
// Función del tiempo (no simulación): cada limadura apunta al campo de hace τ segundos. τ crece con la
// inercia y donde el campo es débil, así se ve una ola de reorientación; el loop es exacto por construcción.
// B = (3(m·r̂)r̂ − m)/|r|³ sumado sobre los imanes, evaluado por limadura.
// Rozamiento: una limadura gira solo donde |B|·fuerza lo supera; en campo débil conserva su ángulo inicial.
// (Primero fue reset + step con inercia: el rozamiento daba memoria de miles de pasos y el loop no cerraba.
// Ver PLAN.md.)
import type { Env, EnvContext } from "../../core/env";
import { font } from "../../core/fonts";
import { mulberry32 } from "../../core/rng";
import { params, type LimadurasParams as P } from "./params";
import { presets } from "./presets";

const BASE_COUNT = 50000; // limaduras con densidad 1 en 1080×1350
const MAX_LAG = 4; // segundos

let W = 1080;
let H = 1350;
let n = 0;
let px = new Float32Array(0);
let py = new Float32Array(0);
let a0 = new Float32Array(0); // ángulo inicial (rozamiento)
let ang = new Float32Array(0); // ángulo del último render (para el SVG)
let placeKey = "";
let mask: Uint8Array = new Uint8Array(0);
let maskKey = "";
/** imanes arrastrados: índice → posición (px del canvas). No reinicia las limaduras. */
const dragged = new Map<number, { x: number; y: number }>();
let grab: number | null = null;
let lastMagnets: Magnet[] = [];

interface Magnet {
  x: number;
  y: number;
  pol: number; // orientación base del momento
}

/** duración del loop: la rotación completa 2π exacto (velocidad ajustada a eso) */
function loopDuration(p: P) {
  const r = p.imanes.rotación;
  return r > 0 ? Math.min(60, Math.max(6, (2 * Math.PI) / r)) : 10;
}

function omega(p: P) {
  return p.imanes.rotación > 0 ? (2 * Math.PI) / loopDuration(p) : 0;
}

function glyphCenters(p: P): { x: number; y: number }[] {
  const g = document.createElement("canvas").getContext("2d")!;
  const sz = (p.tipo.tamaño * Math.min(W, H)) / 1080;
  g.font = font(sz, 700);
  const chars = [...p.texto];
  const widths = chars.map((c) => g.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = W / 2 - total / 2;
  const out: { x: number; y: number }[] = [];
  chars.forEach((c, i) => {
    if (c.trim()) out.push({ x: x + widths[i] / 2, y: H / 2 });
    x += widths[i];
  });
  return out;
}

function magnets(p: P, seed: number): Magnet[] {
  const s = Math.min(W, H);
  let base: Magnet[];
  if (p.imanes.modo === "por letra") {
    base = glyphCenters(p).map((c, i) => ({ ...c, pol: i % 2 ? Math.PI : 0 }));
  } else if (p.imanes.modo === "dipolo único") {
    base = [{ x: W / 2, y: H / 2, pol: 0 }];
  } else {
    const rnd = mulberry32(seed ^ 0xa5a5);
    const k = Math.round(p.imanes.cantidad);
    base = Array.from({ length: k }, (_, i) => {
      const a = (i / k) * Math.PI * 2 + rnd() * 0.6;
      const r = s * (0.18 + rnd() * 0.16);
      return { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r, pol: rnd() * Math.PI * 2 };
    });
  }
  return base.map((b, i) => {
    const d = dragged.get(i);
    return { x: d?.x ?? b.x, y: d?.y ?? b.y, pol: b.pol };
  });
}

/** campo en (x, y) con todos los momentos girados `phi` */
function B(ms: Magnet[], x: number, y: number, phi: number, soft: number): [number, number] {
  let bx = 0;
  let by = 0;
  for (const m of ms) {
    const mx = Math.cos(m.pol + phi);
    const my = Math.sin(m.pol + phi);
    const rx = x - m.x;
    const ry = y - m.y;
    const r2 = rx * rx + ry * ry + soft;
    const r = Math.sqrt(r2);
    const ux = rx / r;
    const uy = ry / r;
    const dot = mx * ux + my * uy;
    const inv = 1 / (r2 * r);
    bx += (3 * dot * ux - mx) * inv;
    by += (3 * dot * uy - my) * inv;
  }
  return [bx, by];
}

function buildMask(p: P) {
  const key = `${W}x${H}|${p.texto}|${p.tipo.tamaño}`;
  if (key === maskKey) return;
  maskKey = key;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  drawWord(g, p, "#ffffff");
  const d = g.getImageData(0, 0, W, H).data;
  mask = new Uint8Array(W * H);
  for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3] > 40 ? 1 : 0;
}

function drawWord(g: CanvasRenderingContext2D, p: P, color: string) {
  const sz = (p.tipo.tamaño * Math.min(W, H)) / 1080;
  g.font = font(sz, 700);
  g.fillStyle = color;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(p.texto, W / 2, H / 2 + sz * 0.04);
}

/** grilla con jitter (rompe la grilla sin tocar el ángulo); ángulo inicial con semilla */
function place(p: P, seed: number) {
  const key = `${W}x${H}|${seed}|${p.limaduras.densidad}|${p.limaduras.jitter}`;
  if (key === placeKey) return;
  placeKey = key;
  const rnd = mulberry32(seed);
  const target = Math.round(BASE_COUNT * p.limaduras.densidad * ((W * H) / (1080 * 1350)));
  const cell = Math.sqrt((W * H) / target);
  const cols = Math.ceil(W / cell);
  const rows = Math.ceil(H / cell);
  n = cols * rows;
  px = new Float32Array(n);
  py = new Float32Array(n);
  a0 = new Float32Array(n);
  ang = new Float32Array(n);
  let k = 0;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      px[k] = Math.min(W - 1, Math.max(0, (i + 0.5 + (rnd() - 0.5) * p.limaduras.jitter) * cell));
      py[k] = Math.min(H - 1, Math.max(0, (j + 0.5 + (rnd() - 0.5) * p.limaduras.jitter) * cell));
      a0[k] = rnd() * Math.PI;
      k++;
    }
}

/** ángulos del frame t */
function solve(t: number, p: P, seed: number) {
  const ms = magnets(p, seed);
  lastMagnets = ms;
  const s = Math.min(W, H);
  const soft = (s * 0.02) ** 2; // núcleo blando: sin singularidad en el polo
  const scale = (s * 0.25) ** 3; // |B| ≈ 1 a un cuarto del lado corto de un imán
  const w = omega(p);
  const inertia = Math.min(0.99, p.limaduras.inercia);
  const lagBase = inertia / (1 - inertia) / 30; // segundos: memoria de un filtro de primer orden a 30 fps
  const f = p.imanes.fuerza;
  for (let k = 0; k < n; k++) {
    const x = px[k];
    const y = py[k];
    const [bx, by] = B(ms, x, y, w * t, soft);
    const grip = Math.min(1, Math.max(0, Math.hypot(bx, by) * scale * f * 4 - 0.15));
    if (grip <= 0) {
      ang[k] = a0[k];
      continue;
    }
    // campo débil = más retardo: la reorientación avanza como una ola desde los imanes
    const lag = Math.min(MAX_LAG, lagBase / Math.max(0.15, grip));
    const [lx, ly] = w ? B(ms, x, y, w * (t - lag), soft) : [bx, by];
    let d = Math.atan2(ly, lx) - a0[k];
    d -= Math.PI * Math.round(d / Math.PI); // limaduras sin sentido: diferencia en [−π/2, π/2]
    ang[k] = a0[k] + d * grip;
  }
}

function draw(g: CanvasRenderingContext2D, t: number, p: P, ctx: EnvContext) {
  W = ctx.width;
  H = ctx.height;
  buildMask(p);
  place(p, ctx.seed);
  solve(t, p, ctx.seed);
  const { palette } = ctx;
  g.fillStyle = palette.bg;
  g.fillRect(0, 0, W, H);
  const s = Math.min(W, H);
  const half = (p.limaduras.largo * s) / 1080 / 2;
  g.strokeStyle = palette.fg;
  g.lineWidth = Math.max(1.5, (p.limaduras.grosor * s) / 1080);
  g.lineCap = "butt";
  g.beginPath();
  const hide = p.tipo.ocultarDentro;
  for (let k = 0; k < n; k++) {
    const x = px[k];
    const y = py[k];
    if (hide && mask[(y | 0) * W + (x | 0)]) continue;
    const c = Math.cos(ang[k]) * half;
    const sn = Math.sin(ang[k]) * half;
    g.moveTo(x - c, y - sn);
    g.lineTo(x + c, y + sn);
  }
  g.stroke();
  if (p.tipo.mostrarGlifo) drawWord(g, p, palette.fg);
}

function svg(p: P, ctx: EnvContext): string {
  const { palette } = ctx;
  const s = Math.min(W, H);
  const half = (p.limaduras.largo * s) / 1080 / 2;
  const sw = Math.max(1.5, (p.limaduras.grosor * s) / 1080);
  const lines: string[] = [];
  for (let k = 0; k < n; k++) {
    const x = px[k];
    const y = py[k];
    if (p.tipo.ocultarDentro && mask[(y | 0) * W + (x | 0)]) continue;
    const c = Math.cos(ang[k]) * half;
    const sn = Math.sin(ang[k]) * half;
    lines.push(`<line x1="${(x - c).toFixed(1)}" y1="${(y - sn).toFixed(1)}" x2="${(x + c).toFixed(1)}" y2="${(y + sn).toFixed(1)}"/>`);
  }
  const sz = (p.tipo.tamaño * s) / 1080;
  const text = p.tipo.mostrarGlifo
    ? `<text x="${W / 2}" y="${(H / 2 + sz * 0.04).toFixed(1)}" fill="${palette.fg}" font-family="Archivo Narrow" font-weight="700" font-size="${sz.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${p.texto.replace(/[<>&]/g, "")}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${palette.bg}"/>
<g stroke="${palette.fg}" stroke-width="${sw.toFixed(2)}">${lines.join("")}</g>
${text}
</svg>`;
}

const env: Env<P> = {
  id: "limaduras",
  num: "01",
  title: "limaduras",
  version: "1.0.0",
  category: "física",
  target: "canvas2d",
  inputs: ["pointer", "text"],
  params,
  presets,
  timeline: (p) => ({ duration: loopDuration(p), loop: "seamless", fps: 30 }),
  init: (_t, ctx) => {
    W = ctx.width;
    H = ctx.height;
    maskKey = "";
    placeKey = "";
  },
  update: (_p, changed) => {
    if (changed.includes("imanes.modo") || changed.includes("imanes.cantidad") || changed.includes("texto")) dragged.clear();
  },
  render: (target, t, p, ctx) => {
    if (target.kind === "canvas2d") draw(target.ctx, t, p, ctx);
  },
  onPointer: (e, p) => {
    if (e.type === "down") {
      const s = Math.min(W, H);
      let best = -1;
      let bd = (s * 0.08) ** 2;
      lastMagnets.forEach((m, i) => {
        const d = (m.x - e.x) ** 2 + (m.y - e.y) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      grab = best >= 0 && p.imanes.modo !== "dipolo único" ? best : null;
    } else if (e.type === "move" && grab !== null) {
      dragged.set(grab, { x: e.x, y: e.y });
    } else if (e.type === "up") grab = null;
  },
  random: (s, p) => {
    const rnd = mulberry32(s);
    const modos: P["imanes"]["modo"][] = ["por letra", "libres", "dipolo único"];
    const words = ["IMAN", "CAMPO", "NORTE", "POLO", "HIERRO"];
    return {
      texto: words[(rnd() * words.length) | 0],
      imanes: { ...p.imanes, modo: modos[(rnd() * 3) | 0], cantidad: 2 + ((rnd() * 5) | 0), rotación: Math.round((0.1 + rnd() * 0.4) * 100) / 100 },
      limaduras: { ...p.limaduras, largo: Math.round(8 + rnd() * 16), inercia: Math.round((0.75 + rnd() * 0.2) * 100) / 100 },
    };
  },
  // reiniciar: vuelve los imanes arrastrados a su lugar y t a 0
  actions: {
    reiniciar: () => {
      dragged.clear();
      return { reset: true };
    },
  },
  exports: { svg },
};

export default env;
