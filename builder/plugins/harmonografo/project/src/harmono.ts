// Núcleo puro del harmonógrafo. Sin DOM. Lo comparten la preview, el export MP4 y el SVG.
export type Axis = "x" | "y" | "rot";
export interface Pendulum {
  axis: Axis;      // x / y = péndulo lateral; rot = mesa rotativa (mueve el papel en círculo)
  freq: number;    // rad por unidad de tiempo (los presets usan razones chicas + desafinación)
  phase: number;   // radianes
  amp: number;     // 0..1 (relativo; se normaliza al encuadre)
  damp: number;    // amortiguación por unidad de tiempo
}
export interface Params {
  name: string;
  pendulums: Pendulum[];
  tEnd: number;        // tiempo físico máximo
  cutoff: number;      // corta cuando la envolvente cae bajo este % de la inicial (0..1)
  penWidth: number;    // px a 1080 de ancho
  drawSeconds: number; // cuánto tarda en dibujarse (segundos de video)
  holdSeconds: number; // cuánto queda quieto antes del corte
  timeMode: "fisico" | "arco"; // la pluma avanza en tiempo físico (frena al final) o a velocidad de arco constante
  palette: number;     // índice del par
  invert: boolean;
  caption: boolean;    // receta en Archivo Narrow abajo
  margin: number;      // 0..0.3
}

export interface Path {
  xs: Float32Array; ys: Float32Array; // coordenadas en px del lienzo
  ts: Float32Array;                    // tiempo físico de cada punto
  cum: Float32Array;                   // largo acumulado
  n: number;
  length: number;
  tStop: number;
}

function envelope(p: Params, t: number) {
  let s = 0, s0 = 0;
  for (const q of p.pendulums) { s += q.amp * Math.exp(-q.damp * t); s0 += q.amp; }
  return s0 > 0 ? s / s0 : 0;
}

export function rawXY(p: Params, t: number): [number, number] {
  let x = 0, y = 0;
  for (const q of p.pendulums) {
    const e = q.amp * Math.exp(-q.damp * t);
    const a = q.freq * t + q.phase;
    if (q.axis === "x") x += e * Math.sin(a);
    else if (q.axis === "y") y += e * Math.sin(a);
    else { x += e * Math.sin(a); y += e * Math.cos(a); }
  }
  return [x, y];
}

/** Integra la ecuación y la remuestrea por largo de arco (paso ~stepPx) para que la línea sea pareja. */
export function buildPath(p: Params, W: number, H: number, stepPx = 0.8): Path {
  // tiempo de corte por envolvente
  let tStop = p.tEnd;
  for (let t = 0; t < p.tEnd; t += 0.25) if (envelope(p, t) < p.cutoff) { tStop = t; break; }
  // extensión máxima posible por eje
  let ex = 0, ey = 0;
  for (const q of p.pendulums) { if (q.axis !== "y") ex += q.amp; if (q.axis !== "x") ey += q.amp; }
  ex = Math.max(ex, 1e-6); ey = Math.max(ey, 1e-6);
  const m = p.margin;
  const capH = p.caption ? H * 0.09 : 0;
  const availW = W * (1 - 2 * m), availH = (H - capH) * (1 - 2 * m);
  const s = Math.min(availW / (2 * ex), availH / (2 * ey));
  const cx = W / 2, cy = (H - capH) / 2;
  // muestreo fino en t
  const maxF = Math.max(...p.pendulums.map(q => Math.abs(q.freq)), 0.1);
  const dt = Math.min(0.02, (2 * Math.PI / maxF) / 120);
  const N = Math.ceil(tStop / dt) + 1;
  const outX: number[] = [], outY: number[] = [], outT: number[] = [], outC: number[] = [];
  let [px, py] = rawXY(p, 0); px = cx + px * s; py = cy - py * s;
  outX.push(px); outY.push(py); outT.push(0); outC.push(0);
  let acc = 0, total = 0, lx = px, ly = py;
  for (let i = 1; i < N; i++) {
    const t = i * dt;
    let [x, y] = rawXY(p, t); x = cx + x * s; y = cy - y * s;
    const d = Math.hypot(x - lx, y - ly);
    acc += d; total += d; lx = x; ly = y;
    if (acc >= stepPx || i === N - 1) { outX.push(x); outY.push(y); outT.push(t); outC.push(total); acc = 0; }
  }
  return { xs: Float32Array.from(outX), ys: Float32Array.from(outY), ts: Float32Array.from(outT), cum: Float32Array.from(outC), n: outX.length, length: total, tStop };
}

/** Índice de punto alcanzado en progreso u (0..1) según el modo de tiempo. */
export function indexAt(path: Path, u: number, mode: Params["timeMode"]): number {
  u = Math.max(0, Math.min(1, u));
  if (u >= 1) return path.n - 1;
  const arr = mode === "fisico" ? path.ts : path.cum;
  const target = u * (mode === "fisico" ? path.tStop : path.length);
  let lo = 0, hi = path.n - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < target) lo = mid + 1; else hi = mid; }
  return lo;
}

/** Douglas–Peucker iterativo para el SVG de plotter. */
export function simplify(xs: Float32Array, ys: Float32Array, n: number, eps: number): number[] {
  const keep = new Uint8Array(n); keep[0] = 1; keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = xs[a], ay = ys[a], bx = xs[b], by = ys[b];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    let md = -1, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * xs[i] - dx * ys[i] + bx * ay - by * ax) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  const idx: number[] = []; for (let i = 0; i < n; i++) if (keep[i]) idx.push(i);
  return idx;
}

// Pares cerrados. Nunca #0000FF ni #3D3DEB.
export const PALETTES: { name: string; bg: string; fg: string }[] = [
  { name: "ink / blanco", bg: "#0C0C0C", fg: "#FFFFFF" },
  { name: "acid / ink", bg: "#E4FC24", fg: "#0C0C0C" },
  { name: "lila / marrón", bg: "#CC84FC", fg: "#3C240C" },
  { name: "magenta / verde", bg: "#F06CCC", fg: "#0C540C" },
];
export function colors(p: Params) {
  const c = PALETTES[((p.palette % PALETTES.length) + PALETTES.length) % PALETTES.length];
  return p.invert ? { bg: c.fg, fg: c.bg, name: c.name } : c;
}

export function recipe(p: Params): string {
  return p.pendulums.map(q => `${q.axis} ${q.freq.toFixed(3)} · ${q.phase.toFixed(2)} · ${q.amp.toFixed(2)} · ${q.damp.toFixed(4)}`).join("   ");
}

/** Random curado: razones enteras chicas + desafinación leve, que es lo que hace que un harmonógrafo "respire". */
export function randomParams(base: Params, rnd = Math.random): Params {
  // Random curado: frecuencias enteras chicas (2..6) con desafinación leve (±0.008).
  // Razones enteras = figura cerrada; la desafinación + amortiguación = que "respire" y no sea un Lissajous fijo.
  const n = base.pendulums.length;
  const ints = [2, 3, 4, 2, 3, 5, 6];
  const pendulums: Pendulum[] = [];
  for (let i = 0; i < n; i++) pendulums.push(randomPendulum(i, rnd, ints));
  return { ...base, name: "random", pendulums };
}
export function randomPendulum(i: number, rnd = Math.random, ints = [2, 3, 4, 2, 3, 5, 6]): Pendulum {
  const axis: Axis = i === 0 ? "x" : i === 1 ? "y" : rnd() < 0.4 ? "rot" : (i % 2 ? "y" : "x");
  const f = ints[Math.floor(rnd() * ints.length)] * (axis === "rot" && rnd() < 0.5 ? -1 : 1);
  return {
    axis,
    freq: +(f + (rnd() - 0.5) * 0.016).toFixed(3),
    phase: +(rnd() * Math.PI * 2).toFixed(2),
    amp: +(i < 2 ? 0.7 + rnd() * 0.3 : 0.2 + rnd() * 0.45).toFixed(2),
    damp: +(0.0015 + rnd() * 0.0045).toFixed(4),
  };
}
