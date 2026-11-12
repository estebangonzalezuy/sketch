// 09b Plantas 3D — la misma gramática que Gramática de Plantas (tabla letra → regla), con tortuga 3D.
// + y − inclinan como en 2D; cada rama que se abre ([) rota alrededor del tallo `filotaxis` grados más
// que la anterior (137,5° = ángulo áureo). Con filotaxis 0 es la planta 2D, plana.
// three.js sobre el contexto WebGL2 del builder: tubos instanciados, sombreado por dither de Bayer a
// 2 colores exactos (sin antialias, sin grises). Función del tiempo: crece, sostiene, se poda; la cámara
// da `vueltas` enteras por loop, así el loop cierra.
import * as THREE from "three";
import type { Env, EnvContext } from "../../core/env";
import { font, num } from "../../core/fonts";
import { hexToRgb } from "../../core/palette";
import { mulberry32 } from "../../core/rng";
import { grammar, type Grammar } from "../_plantas/grammar";
import { params, type Plantas3dParams as P } from "./params";
import { presets } from "./presets";

const HOLD = 1.5;
const MAX_SYMBOLS = 60000; // menos que en 2D: cada tramo es un tubo
const FOV = 28;

interface Plant {
  gr: Grammar;
  n: number;
  a: Float32Array; // inicio xyz por tramo
  b: Float32Array; // fin xyz por tramo
  gen: Uint8Array;
  maxGen: number;
  center: THREE.Vector3;
  radius: number; // esfera que contiene la planta
}

// ── tortuga 3D ──
function build(p: P, seed: number): Plant {
  const gr = grammar(p.palabra, p.gramática.profundidad, p.gramática.ángulo, MAX_SYMBOLS);
  const rnd = mulberry32(seed ^ gr.hash);
  const turn = (gr.angle * Math.PI) / 180;
  const phyl = (p.gramática.filotaxis * Math.PI) / 180;
  const vary = () => 1 + (rnd() * 2 - 1) * p.gramática.variación;
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion(); // orientación: el tallo es +Y local
  const Z = new THREE.Vector3(0, 0, 1);
  const Y = new THREE.Vector3(0, 1, 0);
  const tmpQ = new THREE.Quaternion();
  const dir = new THREE.Vector3();
  const stack: { pos: THREE.Vector3; q: THREE.Quaternion; g: number }[] = [];
  const A: number[] = [];
  const B: number[] = [];
  const G: number[] = [];
  let g = 0;
  let branches = 0;
  let open = false; // ¿el último tramo se puede alargar? (F seguidas sin girar = un solo tubo)
  const box = new THREE.Box3();
  box.expandByPoint(pos);
  for (const c of gr.expanded) {
    if (c === "F") {
      dir.copy(Y).applyQuaternion(q);
      if (open) {
        const k = B.length - 3;
        B[k] += dir.x;
        B[k + 1] += dir.y;
        B[k + 2] += dir.z;
      } else {
        A.push(pos.x, pos.y, pos.z);
        B.push(pos.x + dir.x, pos.y + dir.y, pos.z + dir.z);
        G.push(g);
        open = true;
      }
      pos.add(dir);
      box.expandByPoint(pos);
      continue;
    }
    open = false;
    if (c === "+") q.multiply(tmpQ.setFromAxisAngle(Z, turn * vary()));
    else if (c === "-") q.multiply(tmpQ.setFromAxisAngle(Z, -turn * vary()));
    else if (c === "[") {
      stack.push({ pos: pos.clone(), q: q.clone(), g });
      g++;
      branches++;
      q.multiply(tmpQ.setFromAxisAngle(Y, phyl * branches)); // filotaxis: cada rama, un poco más girada
    } else if (c === "]") {
      const st = stack.pop();
      if (st) {
        pos.copy(st.pos);
        q.copy(st.q);
        g = st.g;
      }
    }
  }
  const center = box.getCenter(new THREE.Vector3());
  // radio alrededor del eje vertical que pasa por el centro (la cámara orbita ese eje)
  let r2 = 0;
  for (let i = 0; i < B.length; i += 3) r2 = Math.max(r2, (B[i] - center.x) ** 2 + (B[i + 1] - center.y) ** 2 + (B[i + 2] - center.z) ** 2);
  const maxGen = G.reduce((m, v) => Math.max(m, v), 0);
  return { gr, n: G.length, a: Float32Array.from(A), b: Float32Array.from(B), gen: Uint8Array.from(G.map((v) => Math.min(255, v))), maxGen, center, radius: Math.sqrt(r2) || 1 };
}

// ── escena ──
const VERT = /* glsl */ `
varying vec3 vN;
void main() {
  vN = normalize(normalMatrix * (mat3(instanceMatrix) * normal));
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
// luz fija respecto de la cámara; el tono se resuelve con Bayer 4×4: cada píxel es fg o bg, nada en el medio
const FRAG = /* glsl */ `
uniform vec3 uFg;
uniform vec3 uBg;
uniform float uDither;
varying vec3 vN;
const float BAYER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
void main() {
  float v = 0.3 + 0.7 * max(dot(normalize(vN), normalize(vec3(-0.55, 0.6, 0.58))), 0.0);
  ivec2 c = ivec2(gl_FragCoord.xy) & 3;
  float th = (BAYER[c.y * 4 + c.x] + 0.5) / 16.0;
  gl_FragColor = vec4((uDither < 0.5 || v > th) ? uFg : uBg, 1.0);
}`;

let renderer: THREE.WebGLRenderer | null = null;
let rendererGl: WebGL2RenderingContext | null = null;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, 0.8, 0.1, 1000);
const material = new THREE.ShaderMaterial({
  vertexShader: VERT,
  fragmentShader: FRAG,
  uniforms: { uFg: { value: new THREE.Vector3(1, 1, 1) }, uBg: { value: new THREE.Vector3(0, 0, 0) }, uDither: { value: 1 } },
});
const tube = new THREE.CylinderGeometry(1, 1, 1, 7, 1, false).translate(0, 0.5, 0); // base en el origen, a lo largo de +Y
const joint = new THREE.IcosahedronGeometry(1, 1);
let tubes: THREE.InstancedMesh | null = null;
let joints: THREE.InstancedMesh | null = null;

let plant: Plant | null = null;
let plantKey = "";
let meshKey = "";
let order: Uint32Array = new Uint32Array(0);
let cum: Float32Array = new Float32Array(0); // largo acumulado en el orden de crecimiento
let radii: Float32Array = new Float32Array(0);
let lastPartial = -1;
let lastAz = 0;
let lastEl = 0;
let lastDist = 1;

const m4 = new THREE.Matrix4();
const qq = new THREE.Quaternion();
const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const vs = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function segMatrix(pl: Plant, i: number, r: number, frac: number, out: THREE.Matrix4) {
  va.fromArray(pl.a, i * 3);
  vb.fromArray(pl.b, i * 3).sub(va);
  const len = vb.length();
  qq.setFromUnitVectors(UP, vb.divideScalar(len || 1));
  return out.compose(va, qq, vs.set(r, len * frac, r));
}

function distance(pl: Plant, p: P, ctx: EnvContext) {
  const aspect = ctx.width / ctx.height;
  const half = (FOV * Math.PI) / 360;
  const halfMin = Math.min(half, Math.atan(Math.tan(half) * aspect));
  return (pl.radius / Math.sin(halfMin)) * 1.22 * p.cámara.distancia; // 1,22: aire para la regla y la palabra
}

function ensure(p: P, ctx: EnvContext): Plant {
  const pk = JSON.stringify([p.palabra, p.gramática, ctx.seed]);
  if (pk !== plantKey || !plant) {
    plant = build(p, ctx.seed);
    plantKey = pk;
    meshKey = "";
  }
  const pl = plant;
  const mk = JSON.stringify([pk, p.crecimiento.orden, p.trazo.grosor, p.trazo.afinar, p.cámara.distancia, ctx.width, ctx.height]);
  if (mk !== meshKey) {
    meshKey = mk;
    const idx = Array.from({ length: pl.n }, (_, i) => i);
    if (p.crecimiento.orden === "por generación") idx.sort((x, y) => pl.gen[x] - pl.gen[y] || x - y);
    order = Uint32Array.from(idx);
    // grosor en píxeles del canvas (a la distancia del centro) → unidades de la planta
    const d = distance(pl, p, ctx);
    const perPx = (2 * d * Math.tan((FOV * Math.PI) / 360)) / ctx.height;
    const base = (p.trazo.grosor / 2) * (Math.min(ctx.width, ctx.height) / 1080) * perPx;
    const minR = 0.75 * (Math.min(ctx.width, ctx.height) / 1080) * perPx;
    cum = new Float32Array(pl.n + 1);
    radii = new Float32Array(pl.n);
    if (tubes) scene.remove(tubes);
    if (joints) scene.remove(joints);
    tubes?.dispose();
    joints?.dispose();
    tubes = new THREE.InstancedMesh(tube, material, Math.max(1, pl.n));
    joints = new THREE.InstancedMesh(joint, material, Math.max(1, pl.n));
    tubes.frustumCulled = joints.frustumCulled = false;
    for (let j = 0; j < pl.n; j++) {
      const i = order[j];
      const r = Math.max(minR, p.trazo.afinar ? base * (1 - (0.7 * pl.gen[i]) / Math.max(1, pl.maxGen)) : base);
      radii[j] = r;
      tubes.setMatrixAt(j, segMatrix(pl, i, r, 1, m4));
      // junta redonda en la punta de cada tramo (tapa los quiebres entre tubos)
      vb.fromArray(pl.b, i * 3);
      joints.setMatrixAt(j, m4.compose(vb, qq.identity(), vs.set(r, r, r)));
      va.fromArray(pl.a, i * 3);
      cum[j + 1] = cum[j] + va.distanceTo(vb);
    }
    lastPartial = -1;
    scene.add(tubes, joints);
  }
  return pl;
}

/** fracción visible en t: crece, sostiene, poda en reversa (igual que el 2D) */
function visible(t: number, p: P) {
  const S = p.crecimiento.segundos;
  const prune = S * 0.5;
  const T = S + HOLD + prune + 0.5;
  const u = ((t % T) + T) % T;
  if (u < S) return u / S;
  if (u < S + HOLD) return 1;
  if (u < S + HOLD + prune) return 1 - (u - S - HOLD) / prune;
  return 0;
}
const duration = (p: P) => p.crecimiento.segundos * 1.5 + HOLD + 0.5;

function placeCamera(pl: Plant, t: number, p: P, ctx: EnvContext) {
  const T = duration(p);
  lastAz = 2 * Math.PI * Math.round(p.cámara.vueltas) * ((((t % T) + T) % T) / T);
  lastEl = (p.cámara.elevación * Math.PI) / 180;
  lastDist = distance(pl, p, ctx);
  camera.aspect = ctx.width / ctx.height;
  camera.near = lastDist * 0.05;
  camera.far = lastDist * 4;
  camera.position.set(
    pl.center.x + lastDist * Math.cos(lastEl) * Math.sin(lastAz),
    pl.center.y + lastDist * Math.sin(lastEl),
    pl.center.z + lastDist * Math.cos(lastEl) * Math.cos(lastAz),
  );
  camera.lookAt(pl.center);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

function draw(gl: WebGL2RenderingContext, overlay: CanvasRenderingContext2D, t: number, p: P, ctx: EnvContext) {
  if (!renderer || rendererGl !== gl) return;
  const pl = ensure(p, ctx);
  const { palette } = ctx;
  const fg = hexToRgb(palette.fg);
  const bg = hexToRgb(palette.bg);
  material.uniforms.uFg.value.set(fg[0] / 255, fg[1] / 255, fg[2] / 255);
  material.uniforms.uBg.value.set(bg[0] / 255, bg[1] / 255, bg[2] / 255);
  material.uniforms.uDither.value = p.trazo.sombreado === "dither" ? 1 : 0;

  // crecimiento por largo acumulado
  const target = visible(t, p) * cum[pl.n];
  let lo = 0;
  let hi = pl.n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid + 1] <= target) lo = mid + 1;
    else hi = mid;
  }
  const full = lo; // tramos completos
  const frac = full < pl.n ? (target - cum[full]) / Math.max(1e-9, cum[full + 1] - cum[full]) : 0;
  if (tubes && joints) {
    if (lastPartial >= 0 && lastPartial < pl.n) tubes.setMatrixAt(lastPartial, segMatrix(pl, order[lastPartial], radii[lastPartial], 1, m4));
    if (frac > 0) {
      tubes.setMatrixAt(full, segMatrix(pl, order[full], radii[full], frac, m4));
      lastPartial = full;
    } else lastPartial = -1;
    tubes.instanceMatrix.needsUpdate = true;
    tubes.count = full + (frac > 0 ? 1 : 0);
    joints.count = full;
    tubes.visible = tubes.count > 0;
    joints.visible = joints.count > 0;
  }

  placeCamera(pl, t, p, ctx);
  renderer.state.buffers.color.setClear(bg[0] / 255, bg[1] / 255, bg[2] / 255, 1, false);
  renderer.clear(true, true, true);
  renderer.render(scene, camera);

  // texto en la capa 2D del builder
  const { width: w, height: h } = ctx;
  const s = Math.min(w, h);
  overlay.fillStyle = palette.fg;
  overlay.textAlign = "center";
  overlay.textBaseline = "alphabetic";
  overlay.font = font(s * 0.06, 700);
  overlay.fillText(p.palabra, w / 2, h - s * 0.08);
  if (p.mostrarRegla) {
    overlay.font = font(s * 0.022, 400);
    const rule = `X → ${pl.gr.rule.replace(/-/g, "−")} · F → FF · ${num(pl.gr.angle, 1)}° · filotaxis ${num(p.gramática.filotaxis, 1)}° · prof. ${pl.gr.depth}`;
    overlay.fillText(fit(overlay, rule, w - s * 0.16), w / 2, s * 0.08);
    const notes = [...pl.gr.fix, pl.gr.cut ? `profundidad recortada a ${pl.gr.depth}` : ""].filter(Boolean);
    if (notes.length) overlay.fillText(notes.join(" · "), w / 2, s * 0.08 + s * 0.032);
  }
}

function fit(g: CanvasRenderingContext2D, text: string, max: number) {
  if (g.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 4 && g.measureText(s + "…").width > max) s = s.slice(0, -1);
  return s + "…";
}

/** SVG plotteable: la planta entera proyectada con la cámara del último cuadro dibujado. */
function svg(p: P, ctx: EnvContext) {
  const pl = ensure(p, ctx);
  const { width: w, height: h, palette } = ctx;
  const s = Math.min(w, h);
  const proj = (arr: Float32Array, i: number) => {
    va.fromArray(arr, i * 3).project(camera);
    return `${(((va.x + 1) / 2) * w).toFixed(1)} ${(((1 - va.y) / 2) * h).toFixed(1)}`;
  };
  const perPx = (2 * lastDist * Math.tan((FOV * Math.PI) / 360)) / h;
  const groups = new Map<number, string[]>();
  for (let j = 0; j < pl.n; j++) {
    const i = order[j];
    const sw = Math.max(0.75, Math.round(((radii[j] * 2) / perPx) * 2) / 2);
    const d = `M${proj(pl.a, i)}L${proj(pl.b, i)}`;
    const g = groups.get(sw);
    if (g) g.push(d);
    else groups.set(sw, [d]);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${palette.bg}"/>
<g fill="none" stroke="${palette.fg}" stroke-linecap="round">${[...groups].map(([sw, d]) => `<path stroke-width="${sw}" d="${d.join("")}"/>`).join("")}</g>
<text x="${w / 2}" y="${(h - s * 0.08).toFixed(1)}" fill="${palette.fg}" font-family="Archivo Narrow" font-weight="700" font-size="${(s * 0.06).toFixed(1)}" text-anchor="middle">${p.palabra.replace(/[<>&]/g, "")}</text>
</svg>`;
}

const NAMES = ["ESTEBAN", "ANA", "X", "LUCIA", "BARCELONA", "MOTION", "SOCIAL", "CLUB", "REBOOT", "HEX"];

const env: Env<P> = {
  id: "plantas-3d",
  num: "09b",
  title: "plantas 3d",
  version: "1.0.0",
  category: "generativo · 3d",
  target: "webgl2",
  inputs: ["text"],
  params,
  presets,
  timeline: (p) => ({ duration: duration(p), loop: "seamless", fps: 30 }),
  init: (target, ctx) => {
    if (target.kind !== "webgl2") throw new Error("plantas 3d necesita webgl2");
    const gl = target.ctx;
    if (!renderer || rendererGl !== gl) {
      renderer?.dispose();
      renderer = new THREE.WebGLRenderer({ canvas: gl.canvas as HTMLCanvasElement, context: gl, antialias: false });
      rendererGl = gl;
      renderer.autoClear = false;
      renderer.setPixelRatio(1);
    }
    // el contexto es compartido con otros entornos WebGL2: three no puede confiar en su caché de estado
    renderer.resetState();
    renderer.setSize(ctx.width, ctx.height, false);
    meshKey = "";
  },
  update: () => {},
  render: (target, t, p, ctx) => {
    if (target.kind === "webgl2") draw(target.ctx, target.overlay, t, p, ctx);
  },
  random: (seed, p) => {
    const rnd = mulberry32(seed);
    const phyl = [137.5, 137.5, 90, 120, 60];
    return {
      palabra: NAMES[(rnd() * NAMES.length) | 0],
      gramática: { ...p.gramática, ángulo: Math.round(18 + rnd() * 22), variación: Math.round(rnd() * 25) / 100, profundidad: 4 + ((rnd() * 3) | 0), filotaxis: phyl[(rnd() * phyl.length) | 0] },
      cámara: { ...p.cámara, elevación: Math.round(rnd() * 40) },
    };
  },
  exports: { svg },
  // deja el contexto compartido como lo espera un entorno de GL crudo
  dispose: () => {
    if (!renderer || !rendererGl) return;
    renderer.resetState();
    const gl = rendererGl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.depthMask(true);
    gl.colorMask(true, true, true, true);
  },
};

export default env;
