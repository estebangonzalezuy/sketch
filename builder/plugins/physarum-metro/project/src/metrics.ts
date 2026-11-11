// Métrica honesta sobre el raster del rastro. Se calcula, nunca se estima.
export interface MetricResult {
  step: number;
  tolM: number;
  recall: number; // fracción de la red real (px de línea) con moho a < tol
  precision: number; // fracción del moho (px) con red real a < tol
  mstRecall: number;
  mstPrecision: number;
  connected: number; // estaciones en la componente más grande del moho
  stations: number;
  mossLengthKm: number; // largo del esqueleto del moho
  realLengthKm: number;
  mstLengthKm: number;
  ms: number;
}

function dilate(mask: Uint8Array, W: number, H: number, r: number): Uint8Array {
  if (r <= 0) return mask.slice();
  const tmp = new Uint8Array(W * H), out = new Uint8Array(W * H);
  const pre = new Int32Array(Math.max(W, H) + 1);
  for (let y = 0; y < H; y++) {
    pre[0] = 0;
    for (let x = 0; x < W; x++) pre[x + 1] = pre[x] + mask[y * W + x];
    for (let x = 0; x < W; x++) {
      const a = Math.max(0, x - r), b = Math.min(W, x + r + 1);
      tmp[y * W + x] = pre[b] - pre[a] > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < W; x++) {
    pre[0] = 0;
    for (let y = 0; y < H; y++) pre[y + 1] = pre[y] + tmp[y * W + x];
    for (let y = 0; y < H; y++) {
      const a = Math.max(0, y - r), b = Math.min(H, y + r + 1);
      out[y * W + x] = pre[b] - pre[a] > 0 ? 1 : 0;
    }
  }
  return out;
}

function raster(W: number, H: number, polys: [number, number][][], width: number): Uint8Array {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#fff"; g.lineWidth = width; g.lineCap = "round"; g.lineJoin = "round";
  g.imageSmoothingEnabled = false;
  for (const p of polys) {
    if (p.length < 2) continue;
    g.beginPath(); g.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]);
    g.stroke();
  }
  const d = g.getImageData(0, 0, W, H).data;
  const m = new Uint8Array(W * H);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4] > 127 ? 1 : 0;
  return m;
}

function count(m: Uint8Array) { let n = 0; for (let i = 0; i < m.length; i++) n += m[i]; return n; }
function both(a: Uint8Array, b: Uint8Array) { let n = 0; for (let i = 0; i < a.length; i++) n += a[i] & b[i]; return n; }

/** Árbol de expansión mínima (Prim) sobre estaciones. */
export function mst(pts: [number, number][]): [number, number][] {
  const n = pts.length; if (n < 2) return [];
  const inT = new Uint8Array(n), best = new Float64Array(n).fill(Infinity), from = new Int32Array(n).fill(-1);
  best[0] = 0; const edges: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!inT[i] && (u < 0 || best[i] < best[u])) u = i;
    inT[u] = 1; if (from[u] >= 0) edges.push([from[u], u]);
    for (let v = 0; v < n; v++) if (!inT[v]) {
      const d = Math.hypot(pts[u][0] - pts[v][0], pts[u][1] - pts[v][1]);
      if (d < best[v]) { best[v] = d; from[v] = u; }
    }
  }
  return edges;
}

function polyLen(polys: [number, number][][]) {
  let L = 0;
  for (const p of polys) for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return L;
}

/** Esqueleto por adelgazamiento Zhang–Suen (para medir largo del moho). */
function thin(mask: Uint8Array, W: number, H: number): Uint8Array {
  const m = mask.slice();
  let changed = true; const del: number[] = [];
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : m[y * W + x]);
  let iter = 0;
  while (changed && iter < 60) {
    changed = false; iter++;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        if (!m[y * W + x]) continue;
        const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1), p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;
        const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
        let A = 0; for (let i = 0; i < 8; i++) if (!seq[i] && seq[i + 1]) A++;
        if (A !== 1) continue;
        if (pass === 0 ? (p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0) : (p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0)) del.push(y * W + x);
      }
      if (del.length) { changed = true; for (const i of del) m[i] = 0; }
    }
  }
  return m;
}

export function computeMetrics(o: {
  trail: Float32Array; W: number; H: number; step: number;
  scale: number; gamma: number; thr: number;
  tolPx: number; tolM: number; mPerPx: number;
  real: [number, number][][]; stations: [number, number][];
}): MetricResult {
  const t0 = performance.now();
  const { W, H } = o;
  const moss = new Uint8Array(W * H);
  for (let i = 0; i < moss.length; i++) {
    const n = Math.pow(1 - Math.exp(-o.trail[i] / o.scale), o.gamma);
    moss[i] = n > o.thr ? 1 : 0;
  }
  const realLine = raster(W, H, o.real, 1.2);
  const realNear = raster(W, H, o.real, 2 * o.tolPx + 1);
  const mossNear = dilate(moss, W, H, o.tolPx);
  const edges = mst(o.stations);
  const mstPolys = edges.map(([a, b]) => [o.stations[a], o.stations[b]] as [number, number][]);
  const mstLine = raster(W, H, mstPolys, 1.2);
  const mstNear = dilate(mstLine, W, H, o.tolPx);

  const nReal = count(realLine), nMoss = count(moss), nMst = count(mstLine);
  const recall = nReal ? both(realLine, mossNear) / nReal : 0;
  const precision = nMoss ? both(moss, realNear) / nMoss : 0;
  const mstRecall = nReal ? both(realLine, mstNear) / nReal : 0;
  const mstPrecision = nMst ? both(mstLine, realNear) / nMst : 0;

  // componentes conexas del moho (4-vecinos) y estaciones en la mayor
  const lab = new Int32Array(W * H); let nl = 0; const stack: number[] = [];
  for (let i = 0; i < moss.length; i++) {
    if (!moss[i] || lab[i]) continue;
    nl++; lab[i] = nl; stack.push(i);
    while (stack.length) {
      const j = stack.pop()!; const x = j % W, y = (j / W) | 0;
      if (x > 0 && moss[j - 1] && !lab[j - 1]) { lab[j - 1] = nl; stack.push(j - 1); }
      if (x < W - 1 && moss[j + 1] && !lab[j + 1]) { lab[j + 1] = nl; stack.push(j + 1); }
      if (y > 0 && moss[j - W] && !lab[j - W]) { lab[j - W] = nl; stack.push(j - W); }
      if (y < H - 1 && moss[j + W] && !lab[j + W]) { lab[j + W] = nl; stack.push(j + W); }
    }
  }
  const per = new Map<number, number>();
  for (const [sx, sy] of o.stations) {
    let L = 0;
    for (let r = 0; r <= 3 && !L; r++) for (let dy = -r; dy <= r && !L; dy++) for (let dx = -r; dx <= r && !L; dx++) {
      const x = Math.round(sx) + dx, y = Math.round(sy) + dy;
      if (x >= 0 && y >= 0 && x < W && y < H) L = lab[y * W + x];
    }
    if (L) per.set(L, (per.get(L) || 0) + 1);
  }
  let connected = 0; for (const v of per.values()) connected = Math.max(connected, v);

  const skel = thin(moss, W, H);
  const mossLen = count(skel) * 1.1; // px de esqueleto ≈ largo (factor diagonal medio)
  return {
    step: o.step, tolM: o.tolM, recall, precision, mstRecall, mstPrecision, connected, stations: o.stations.length,
    mossLengthKm: (mossLen * o.mPerPx) / 1000,
    // mismo estimador (esqueleto de un raster de 3 px) para que vías dobles/paralelas no cuenten dos veces
    realLengthKm: (count(thin(raster(W, H, o.real, 3), W, H)) * 1.1 * o.mPerPx) / 1000,
    mstLengthKm: (polyLen(mstPolys) * o.mPerPx) / 1000,
    ms: Math.round(performance.now() - t0),
  };
}
