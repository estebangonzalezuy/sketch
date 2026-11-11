// 05 Superilla — tráfico Nagel–Schreckenberg en una grilla tipo Eixample; cerrás calles.
// Simulación: reset(seed) arma la red y siembra coches; step() = `pasosPorFrame` pasos NaSch.
// Cada tramo es NaSch puro (acelerar, frenar por distancia, frenar al azar, mover). Los nodos tienen cola,
// prioridad a la derecha, ruteo que evita tramos cerrados y anti-gridlock (tras K pasos se libera el giro).
// Sentidos únicos alternados. Borde abierto: entran coches con tasa `entrada` y salen por la otra punta;
// el flujo = salidas por el borde en los últimos 60 pasos (1 paso = 1 s). Modelo simplificado.
import type { Env, EnvContext } from "../../core/env";
import { font } from "../../core/fonts";
import { inkLayer } from "../../core/ink";
import { mulberry32 } from "../../core/rng";
import { params, type SuperillaParams as P } from "./params";
import { presets } from "./presets";

const EXIT = -2;
const UNDECIDED = -1;
const GRIDLOCK_K = 10;
const HISTORY = 360;

interface Seg {
  key: string;
  from: number;
  to: number;
  dx: number;
  dy: number;
  cells: Int8Array; // velocidad o −1
  closed: boolean;
  choice: number; // destino del coche en la última celda
  wait: number;
  entry: boolean; // entra desde fuera de la grilla
}

let W = 1080;
let H = 1350;
let MX = 7;
let MY = 9;
let L = 12;
let segs: Seg[] = [];
let nodeOut: number[][] = [];
let nodeIn: number[][] = [];
let rnd = mulberry32(1);
let stepN = 0;
let exits: number[] = [];
let history: Uint8Array[] = [];
let street: number[] = []; // tramos de la calle del diagrama espacio-tiempo, en orden de marcha
let netKey = "";
const clicked = new Set<string>();

const nid = (i: number, j: number) => j * (MX + 1) + i;

function build(p: P, seed: number) {
  MX = Math.round(p.red.manzanasX);
  MY = Math.round(p.red.manzanasY);
  L = Math.round(p.red.celdasPorTramo);
  netKey = `${MX}|${MY}|${L}`;
  segs = [];
  nodeOut = Array.from({ length: (MX + 1) * (MY + 1) }, () => []);
  nodeIn = Array.from({ length: (MX + 1) * (MY + 1) }, () => []);
  const add = (key: string, from: number, to: number, dx: number, dy: number, entry: boolean) => {
    const id = segs.length;
    segs.push({ key, from, to, dx, dy, cells: new Int8Array(L).fill(-1), closed: false, choice: UNDECIDED, wait: 0, entry });
    nodeOut[from].push(id);
    nodeIn[to].push(id);
  };
  // calles horizontales: pares hacia el este, impares hacia el oeste
  for (let j = 0; j <= MY; j++)
    for (let i = 0; i < MX; i++) {
      const east = j % 2 === 0;
      add(`h:${i}:${j}`, nid(east ? i : i + 1, j), nid(east ? i + 1 : i, j), east ? 1 : -1, 0, east ? i === 0 : i === MX - 1);
    }
  // calles verticales: pares hacia el sur, impares hacia el norte
  for (let i = 0; i <= MX; i++)
    for (let j = 0; j < MY; j++) {
      const south = i % 2 === 0;
      add(`v:${i}:${j}`, nid(i, south ? j : j + 1), nid(i, south ? j + 1 : j), 0, south ? 1 : -1, south ? j === 0 : j === MY - 1);
    }
  // calle del diagrama: la horizontal del medio, en orden de marcha
  const jm = Math.floor(MY / 2);
  const ids = segs.map((s, k) => [s, k] as const).filter(([s]) => s.key.startsWith("h:") && s.key.endsWith(`:${jm}`));
  ids.sort((a, b) => Number(a[0].key.split(":")[1]) - Number(b[0].key.split(":")[1]));
  if (jm % 2 === 1) ids.reverse();
  street = ids.map(([, k]) => k);
  // coches iniciales
  rnd = mulberry32(seed);
  for (const s of segs) for (let x = 0; x < L; x++) if (rnd() < p.tráfico.densidad) s.cells[x] = 0;
  stepN = 0;
  exits = [];
  history = [];
}

/** tramos cerrados según el modo: superilla 3×3 en el centro y/o los clickeados */
function applyClosures(p: P) {
  const closed = new Set<string>();
  if (p.cierre.modo === "superilla 3×3" && MX >= 3 && MY >= 3) {
    const i0 = Math.floor((MX - 3) / 2);
    const j0 = Math.floor((MY - 3) / 2);
    for (const j of [j0 + 1, j0 + 2]) for (let i = i0; i < i0 + 3; i++) closed.add(`h:${i}:${j}`);
    for (const i of [i0 + 1, i0 + 2]) for (let j = j0; j < j0 + 3; j++) closed.add(`v:${i}:${j}`);
  }
  if (p.cierre.modo === "click") clicked.forEach((k) => closed.add(k));
  for (const s of segs) s.closed = closed.has(s.key);
}

/** derecha del que viene con rumbo (dx, dy) en pantalla (y hacia abajo) */
const hasPriorityOver = (b: Seg, a: Seg) => b.dx === a.dy && b.dy === -a.dx; // b viene desde la derecha de a

function decide(s: Seg, node: number, p: P, force: boolean) {
  const outs = nodeOut[node];
  const straight = outs.find((o) => segs[o].dx === s.dx && segs[o].dy === s.dy);
  const turn = outs.find((o) => o !== straight);
  const inside = s.closed; // un coche que ya está en lo cerrado puede seguir por lo cerrado para salir
  const can = (o: number | undefined) => o !== undefined && (!segs[o].closed || inside || force);
  if (straight === undefined) {
    // la calle termina en el borde: sale, o gira si puede
    s.choice = can(turn) && rnd() < p.tráfico.giro ? turn! : EXIT;
    return;
  }
  const wantTurn = rnd() < p.tráfico.giro;
  if (wantTurn && can(turn)) s.choice = turn!;
  else if (can(straight)) s.choice = straight;
  else if (can(turn)) s.choice = turn!;
  else s.choice = UNDECIDED; // todo cerrado: espera (y el anti-gridlock lo destraba)
}

function nodes(p: P) {
  for (let n = 0; n < nodeIn.length; n++) {
    const cands = nodeIn[n].filter((k) => segs[k].cells[L - 1] >= 0);
    if (!cands.length) continue;
    for (const k of cands) {
      const s = segs[k];
      const stuck = s.wait > GRIDLOCK_K;
      if (s.choice === UNDECIDED || stuck) decide(s, n, p, stuck);
    }
    // prioridad a la derecha: si dos quieren el mismo tramo, pasa el que viene por la derecha
    cands.sort((a, b) => (hasPriorityOver(segs[a], segs[b]) ? -1 : hasPriorityOver(segs[b], segs[a]) ? 1 : a - b));
    const taken = new Set<number>();
    for (const k of cands) {
      const s = segs[k];
      if (s.choice === EXIT) {
        s.cells[L - 1] = -1;
        exits.push(stepN);
      } else if (s.choice >= 0 && !taken.has(s.choice) && segs[s.choice].cells[0] < 0) {
        segs[s.choice].cells[0] = 1;
        taken.add(s.choice);
        s.cells[L - 1] = -1;
      } else {
        s.wait++;
        continue;
      }
      s.choice = UNDECIDED;
      s.wait = 0;
    }
  }
}

/** NaSch puro en un tramo: (1) acelerar, (2) frenar por distancia, (3) frenar al azar, (4) mover */
function nasch(s: Seg, p: P) {
  const out = new Int8Array(L).fill(-1);
  let ahead = L; // posición del de adelante (L = el final del tramo: el nodo decide)
  for (let x = L - 1; x >= 0; x--) {
    const v0 = s.cells[x];
    if (v0 < 0) continue;
    let v = Math.min(v0 + 1, p.tráfico.vMax); // 1
    const gap = ahead === L ? L - 1 - x : ahead - x - 1;
    v = Math.min(v, gap); // 2
    if (v > 0 && rnd() < p.tráfico.pFrenado) v--; // 3
    const nx = x + v; // 4
    out[nx] = v;
    ahead = nx;
  }
  s.cells = out;
}

function oneStep(p: P) {
  applyClosures(p);
  nodes(p);
  for (const s of segs) if (s.entry && !s.closed && s.cells[0] < 0 && rnd() < p.tráfico.entrada) s.cells[0] = 1;
  for (const s of segs) nasch(s, p);
  // historia de la calle del diagrama espacio-tiempo
  const row = new Uint8Array(street.length * L);
  street.forEach((k, a) => {
    for (let x = 0; x < L; x++) row[a * L + x] = segs[k].cells[x] >= 0 ? 1 : 0;
  });
  history.push(row);
  if (history.length > HISTORY) history.shift();
  stepN++;
  while (exits.length && exits[0] < stepN - 60) exits.shift();
}

// ── dibujo ──
function layout(ctx: EnvContext) {
  const s = Math.min(ctx.width, ctx.height);
  const m = s * 0.07;
  const top = m + s * 0.06;
  const bottom = ctx.height - m - s * 0.04;
  const k = 0.3; // ancho de calle / manzana
  const b = Math.min((ctx.width - 2 * m) / (MX + (MX + 1) * k), (bottom - top) / (MY + (MY + 1) * k));
  const sw = b * k;
  const ox = (ctx.width - (MX * b + (MX + 1) * sw)) / 2;
  const oy = top + (bottom - top - (MY * b + (MY + 1) * sw)) / 2;
  const node = (n: number) => {
    const i = n % (MX + 1);
    const j = Math.floor(n / (MX + 1));
    return { x: ox + sw / 2 + i * (b + sw), y: oy + sw / 2 + j * (b + sw) };
  };
  return { s, m, b, sw, ox, oy, node };
}

function cellPos(Ly: ReturnType<typeof layout>, sg: Seg, x: number) {
  const a = Ly.node(sg.from);
  const c = Ly.node(sg.to);
  const len = Ly.b;
  const t0 = Ly.sw / 2 + ((x + 0.5) / L) * len;
  return { x: a.x + sg.dx * t0, y: a.y + sg.dy * t0, len, a, c };
}

function flow() {
  return exits.length; // salidas por el borde en los últimos 60 pasos = coches/min (1 paso = 1 s)
}

function drawNet(g: CanvasRenderingContext2D, p: P, ctx: EnvContext) {
  const Ly = layout(ctx);
  const { b, sw, ox, oy, s } = Ly;
  const lw = Math.max(1, 1.5 * (s / 1080));
  inkLayer(g, ctx.palette.fg, (ink) => {
    ink.lineWidth = lw;
    // manzanas (con ochava)
    const c = p.red.ochavas ? b * 0.18 : 0;
    for (let j = 0; j < MY; j++)
      for (let i = 0; i < MX; i++) {
        const x = ox + sw + i * (b + sw);
        const y = oy + sw + j * (b + sw);
        ink.beginPath();
        ink.moveTo(x + c, y);
        ink.lineTo(x + b - c, y);
        ink.lineTo(x + b, y + c);
        ink.lineTo(x + b, y + b - c);
        ink.lineTo(x + b - c, y + b);
        ink.lineTo(x + c, y + b);
        ink.lineTo(x, y + b - c);
        ink.lineTo(x, y + c);
        ink.closePath();
        ink.stroke();
      }
    // tramos cerrados: trama diagonal (sin tercer color)
    for (const sg of segs) {
      if (!sg.closed) continue;
      const a = Ly.node(sg.from);
      const z = Ly.node(sg.to);
      const x0 = Math.min(a.x, z.x) - (sg.dy ? sw / 2 : -sw / 2);
      const y0 = Math.min(a.y, z.y) - (sg.dx ? sw / 2 : -sw / 2);
      const w = sg.dx ? b : sw;
      const h = sg.dy ? b : sw;
      ink.save();
      ink.beginPath();
      ink.rect(x0, y0, w, h);
      ink.clip();
      ink.beginPath();
      const step = Math.max(4, sw * 0.22);
      for (let d = -h; d < w + h; d += step) {
        ink.moveTo(x0 + d, y0);
        ink.lineTo(x0 + d + h, y0 + h);
      }
      ink.stroke();
      ink.restore();
    }
    // coches
    const cs = (p.vista.tamañoCoche * s) / 1080;
    for (const sg of segs)
      for (let x = 0; x < L; x++) {
        if (sg.cells[x] < 0) continue;
        const q = cellPos(Ly, sg, x);
        ink.fillRect(q.x - cs / 2, q.y - cs / 2, cs, cs);
      }
  });
}

function drawSpaceTime(g: CanvasRenderingContext2D, ctx: EnvContext) {
  const { width: w, height: h } = ctx;
  const s = Math.min(w, h);
  const m = s * 0.07;
  const top = m + s * 0.06;
  const cols = street.length * L;
  const cw = (w - 2 * m) / cols;
  const rh = (h - top - m - s * 0.04) / HISTORY;
  g.fillStyle = ctx.palette.fg;
  const y0 = top + (HISTORY - history.length) * rh;
  history.forEach((row, r) => {
    for (let x = 0; x < cols; x++) if (row[x]) g.fillRect(Math.floor(m + x * cw), Math.floor(y0 + r * rh), Math.ceil(cw), Math.ceil(rh));
  });
  g.font = font(s * 0.02, 400);
  g.textAlign = "left";
  g.fillText(`calle ${Math.floor(MY / 2) + 1} · espacio →   tiempo ↓ (1 fila = 1 paso)`, m, top - s * 0.015);
}

function draw(g: CanvasRenderingContext2D, p: P, ctx: EnvContext) {
  const { width: w, height: h, palette } = ctx;
  g.fillStyle = palette.bg;
  g.fillRect(0, 0, w, h);
  if (p.vista.modo === "espacio-tiempo") drawSpaceTime(g, ctx);
  else drawNet(g, p, ctx);
  const s = Math.min(w, h);
  g.fillStyle = palette.fg;
  g.font = font(s * 0.034, 700);
  g.textAlign = "right";
  g.textBaseline = "alphabetic";
  g.fillText(`flujo: ${flow()} coches/min`, w - s * 0.07, s * 0.09);
  g.textAlign = "left";
  g.font = font(s * 0.018, 400);
  g.fillText("modelo simplificado (Nagel–Schreckenberg, 1 paso = 1 s); no es el Eixample real", s * 0.07, h - s * 0.035);
}

function svg(p: P, ctx: EnvContext) {
  const Ly = layout(ctx);
  const { b, sw, ox, oy, s } = Ly;
  const { width: w, height: h, palette } = ctx;
  const c = p.red.ochavas ? b * 0.18 : 0;
  const blocks: string[] = [];
  for (let j = 0; j < MY; j++)
    for (let i = 0; i < MX; i++) {
      const x = ox + sw + i * (b + sw);
      const y = oy + sw + j * (b + sw);
      const pts = [[x + c, y], [x + b - c, y], [x + b, y + c], [x + b, y + b - c], [x + b - c, y + b], [x + c, y + b], [x, y + b - c], [x, y + c]];
      blocks.push(`<polygon points="${pts.map(([a, q]) => `${a.toFixed(1)},${q.toFixed(1)}`).join(" ")}"/>`);
    }
  const cs = (p.vista.tamañoCoche * s) / 1080;
  const cars: string[] = [];
  for (const sg of segs)
    for (let x = 0; x < L; x++) {
      if (sg.cells[x] < 0) continue;
      const q = cellPos(Ly, sg, x);
      cars.push(`<rect x="${(q.x - cs / 2).toFixed(1)}" y="${(q.y - cs / 2).toFixed(1)}" width="${cs.toFixed(1)}" height="${cs.toFixed(1)}"/>`);
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${palette.bg}"/>
<g fill="none" stroke="${palette.fg}" stroke-width="${Math.max(1, 1.5 * (s / 1080)).toFixed(2)}">${blocks.join("")}</g>
<g fill="${palette.fg}">${cars.join("")}</g>
<text x="${w - s * 0.07}" y="${(s * 0.09).toFixed(1)}" fill="${palette.fg}" font-family="Archivo Narrow" font-weight="700" font-size="${(s * 0.034).toFixed(1)}" text-anchor="end">flujo: ${flow()} coches/min</text>
</svg>`;
}

let lastCtx: EnvContext | null = null;

const env: Env<P> = {
  id: "superilla",
  num: "05",
  title: "superilla",
  version: "1.0.0",
  category: "ciudad · simulación",
  target: "canvas2d",
  inputs: ["pointer"],
  params,
  presets,
  timeline: () => ({ duration: 10, loop: "cut", fps: 30 }),
  init: (_t, ctx) => {
    W = ctx.width;
    H = ctx.height;
  },
  update: () => {},
  reset: (seed, p) => build(p, seed),
  step: (_dt, p) => {
    if (`${Math.round(p.red.manzanasX)}|${Math.round(p.red.manzanasY)}|${Math.round(p.red.celdasPorTramo)}` !== netKey) build(p, 1);
    for (let i = 0; i < Math.round(p.pasosPorFrame); i++) oneStep(p);
  },
  render: (target, _t, p, ctx) => {
    lastCtx = ctx;
    W = ctx.width;
    H = ctx.height;
    if (target.kind === "canvas2d") draw(target.ctx, p, ctx);
  },
  // click en un tramo: cerrarlo o abrirlo (modo click). No borra coches.
  onPointer: (e, p) => {
    if (e.type !== "down" || p.cierre.modo !== "click" || !lastCtx) return;
    const Ly = layout(lastCtx);
    let best: Seg | null = null;
    let bd = Ly.sw * 0.8;
    for (const sg of segs) {
      const a = Ly.node(sg.from);
      const z = Ly.node(sg.to);
      const mx = (a.x + z.x) / 2;
      const my = (a.y + z.y) / 2;
      const along = sg.dx ? Math.abs(e.x - mx) : Math.abs(e.y - my);
      const across = sg.dx ? Math.abs(e.y - my) : Math.abs(e.x - mx);
      if (along <= Ly.b / 2 && across < bd) {
        bd = across;
        best = sg;
      }
    }
    if (best) {
      if (clicked.has(best.key)) clicked.delete(best.key);
      else clicked.add(best.key);
    }
  },
  random: (seed, p) => {
    const r = mulberry32(seed);
    return {
      tráfico: { ...p.tráfico, densidad: Math.round((0.15 + r() * 0.3) * 100) / 100, pFrenado: Math.round((0.1 + r() * 0.2) * 100) / 100, entrada: Math.round((0.2 + r() * 0.4) * 100) / 100 },
      cierre: { modo: r() < 0.5 ? "superilla 3×3" : "ninguno" },
    };
  },
  actions: {
    limpiarCierres: () => {
      clicked.clear();
    },
  },
  exports: { svg },
};

export default env;
