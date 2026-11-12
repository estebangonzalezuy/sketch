// 13 Feedback — video feedback simulado: ping-pong de dos texturas en WebGL2.
// Simulación: reset(seed) limpia y step() hace una iteración (transform + umbral 1-bit + semilla).
// Plantilla para los entornos WebGL2 del builder: el GL dibuja, el builder compone, el texto va en 2D encima.
import type { Env, EnvContext } from "../../core/env";
import { font, num } from "../../core/fonts";
import { hexToRgb } from "../../core/palette";
import { mulberry32 } from "../../core/rng";
import { params, type FeedbackParams as P } from "./params";
import { presets } from "./presets";

const VS = `#version 300 es
out vec2 uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// una iteración: muestrear el cuadro anterior transformado, umbral duro, (invertir), sumar la semilla
const FS_STEP = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 o;
uniform sampler2D uPrev;
uniform sampler2D uSeed;
uniform float uZoom, uRot, uAspect, uThresh;
uniform vec2 uOff;
uniform bool uInvert, uInject;
void main() {
  vec2 p = uv - 0.5;
  p.x *= uAspect;
  float c = cos(-uRot), s = sin(-uRot);
  p = mat2(c, s, -s, c) * p / uZoom;
  p.x /= uAspect;
  p += 0.5 - uOff;
  float v = 0.0;
  if (p.x >= 0.0 && p.x <= 1.0 && p.y >= 0.0 && p.y <= 1.0) {
    float b = step(uThresh, texture(uPrev, p).r);
    v = uInvert ? 1.0 - b : b;
  }
  if (uInject) v = max(v, step(0.5, texture(uSeed, uv).r));
  o = vec4(v, v, v, 1.0);
}`;

// salida: estado 0/1 → par de la paleta, nearest (texelFetch) al tamaño del canvas
const FS_SHOW = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 o;
uniform sampler2D uState;
uniform vec3 uBg, uFg;
void main() {
  ivec2 sz = textureSize(uState, 0);
  ivec2 ij = clamp(ivec2(uv * vec2(sz)), ivec2(0), sz - 1);
  float v = texelFetch(uState, ij, 0).r;
  o = vec4(v > 0.5 ? uFg : uBg, 1.0);
}`;

interface GLState {
  gl: WebGL2RenderingContext;
  step: WebGLProgram;
  show: WebGLProgram;
  vao: WebGLVertexArrayObject;
  tex: [WebGLTexture, WebGLTexture];
  fbo: [WebGLFramebuffer, WebGLFramebuffer];
  seedTex: WebGLTexture;
  iw: number;
  ih: number;
  cur: 0 | 1;
}

let S: GLState | null = null;
let W = 1080;
let H = 1350;
let frame = 0;
let seedKey = "";
let resKey = "";
const seedCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;

function compile(gl: WebGL2RenderingContext, fs: string): WebGLProgram {
  const mk = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader");
    return sh;
  };
  const pr = gl.createProgram()!;
  gl.attachShader(pr, mk(gl.VERTEX_SHADER, VS));
  gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr) ?? "link");
  return pr;
}

function divisor(p: P) {
  return p.resolución === "1/4" ? 4 : p.resolución === "1/2" ? 2 : 1;
}

function makeTex(gl: WebGL2RenderingContext, w: number, h: number, filter: number) {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

function freeBuffers(s: GLState) {
  const gl = s.gl;
  s.tex.forEach((t) => gl.deleteTexture(t));
  s.fbo.forEach((f) => gl.deleteFramebuffer(f));
}

function allocBuffers(s: GLState, p: P) {
  const gl = s.gl;
  const d = divisor(p);
  s.iw = Math.max(8, Math.round(W / d));
  s.ih = Math.max(8, Math.round(H / d));
  s.tex = [makeTex(gl, s.iw, s.ih, gl.LINEAR), makeTex(gl, s.iw, s.ih, gl.LINEAR)];
  s.fbo = s.tex.map((t) => {
    const f = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return f;
  }) as [WebGLFramebuffer, WebGLFramebuffer];
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  resKey = `${W}x${H}/${d}`;
  seedKey = "";
}

/** la palabra semilla, rasterizada con Archivo Narrow a la resolución interna */
function uploadSeed(s: GLState, p: P) {
  const key = `${s.iw}x${s.ih}|${p.semilla.texto}|${p.semilla.tamaño}`;
  if (key === seedKey || !seedCanvas) return;
  seedKey = key;
  seedCanvas.width = s.iw;
  seedCanvas.height = s.ih;
  const g = seedCanvas.getContext("2d")!;
  g.fillStyle = "#000000";
  g.fillRect(0, 0, s.iw, s.ih);
  const text = p.semilla.texto.trim();
  if (text) {
    let px = p.semilla.tamaño * Math.min(s.iw, s.ih) * 0.6;
    g.font = font(px, 700);
    const tw = g.measureText(text).width;
    const maxW = p.semilla.tamaño * s.iw;
    if (tw > maxW) px *= maxW / tw;
    g.font = font(px, 700);
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, s.iw / 2, s.ih / 2);
  }
  const gl = s.gl;
  gl.deleteTexture(s.seedTex);
  s.seedTex = makeTex(gl, s.iw, s.ih, gl.NEAREST);
  gl.bindTexture(gl.TEXTURE_2D, s.seedTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // canvas arriba-abajo → textura abajo-arriba
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, seedCanvas);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
}

function ensure(p: P) {
  if (!S) return null;
  if (resKey !== `${W}x${H}/${divisor(p)}`) {
    freeBuffers(S);
    allocBuffers(S, p);
    clear();
  }
  uploadSeed(S, p);
  return S;
}

function clear() {
  if (!S) return;
  const gl = S.gl;
  for (const f of S.fbo) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  S.cur = 0;
  frame = 0;
}

function iterate(p: P) {
  const s = ensure(p);
  if (!s) return;
  const gl = s.gl;
  const src = s.cur;
  const dst = (1 - src) as 0 | 1;
  gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo[dst]);
  gl.viewport(0, 0, s.iw, s.ih);
  gl.useProgram(s.step);
  gl.bindVertexArray(s.vao);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, s.tex[src]);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, s.seedTex);
  const u = (n: string) => gl.getUniformLocation(s.step, n);
  gl.uniform1i(u("uPrev"), 0);
  gl.uniform1i(u("uSeed"), 1);
  gl.uniform1f(u("uZoom"), p.transform.zoom);
  gl.uniform1f(u("uRot"), (p.transform.rotación * Math.PI) / 180);
  gl.uniform1f(u("uAspect"), s.iw / s.ih);
  gl.uniform1f(u("uThresh"), p.umbral.valor);
  gl.uniform2f(u("uOff"), p.transform.desplazamientoX, -p.transform.desplazamientoY);
  gl.uniform1i(u("uInvert"), p.umbral.invertir ? 1 : 0);
  gl.uniform1i(u("uInject"), frame % Math.max(1, Math.round(p.semilla.cada)) === 0 ? 1 : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  s.cur = dst;
  frame++;
}

function show(ctx: EnvContext) {
  if (!S) return;
  const gl = S.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, W, H);
  gl.useProgram(S.show);
  gl.bindVertexArray(S.vao);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, S.tex[S.cur]);
  const u = (n: string) => gl.getUniformLocation(S!.show, n);
  gl.uniform1i(u("uState"), 0);
  const bg = hexToRgb(ctx.palette.bg).map((v) => v / 255);
  const fg = hexToRgb(ctx.palette.fg).map((v) => v / 255);
  gl.uniform3f(u("uBg"), bg[0], bg[1], bg[2]);
  gl.uniform3f(u("uFg"), fg[0], fg[1], fg[2]);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

const CURATED: Partial<P>[] = presets.map((x) => x.params);

const env: Env<P> = {
  id: "feedback",
  num: "13",
  title: "feedback",
  version: "1.0.0",
  category: "sistemas · imagen",
  target: "webgl2",
  params,
  presets,
  timeline: () => ({ duration: 10, loop: "cut", fps: 30 }),
  init: (target, ctx, p) => {
    if (target.kind !== "webgl2") throw new Error("feedback necesita webgl2");
    const gl = target.ctx;
    W = ctx.width;
    H = ctx.height;
    // el contexto es compartido con otros entornos WebGL2 (three.js en Plantas 3D): estado conocido
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.colorMask(true, true, true, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (S && S.gl === gl) freeBuffers(S);
    else
      S = {
        gl,
        step: compile(gl, FS_STEP),
        show: compile(gl, FS_SHOW),
        vao: gl.createVertexArray()!,
        tex: [null!, null!],
        fbo: [null!, null!],
        seedTex: gl.createTexture()!,
        iw: 0,
        ih: 0,
        cur: 0,
      };
    allocBuffers(S, p);
    uploadSeed(S, p);
    clear();
  },
  update: (p) => {
    ensure(p);
  },
  reset: (_seed, p) => {
    ensure(p);
    clear();
  },
  step: (_dt, p) => iterate(p),
  render: (target, _t, p, ctx) => {
    if (target.kind !== "webgl2") return;
    ensure(p);
    show(ctx);
    // texto en 2D encima: solo valores de los params
    const g = target.overlay;
    const m = Math.round(Math.min(ctx.width, ctx.height) * 0.044);
    g.font = font(Math.min(ctx.width, ctx.height) * 0.02, 400);
    g.fillStyle = ctx.palette.fg;
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    const tr = p.transform;
    const label = `zoom ${num(tr.zoom, 3)} · rotación ${num(tr.rotación, 1)}° · umbral ${num(p.umbral.valor)}`;
    // caja de fondo (bg) para que el pie se lea sobre el túnel: sigue siendo el mismo par
    const fs = Math.min(ctx.width, ctx.height) * 0.02;
    const pad = Math.round(fs * 0.5);
    const w = Math.ceil(g.measureText(label).width);
    g.fillStyle = ctx.palette.bg;
    g.fillRect(m - pad, ctx.height - m - fs - pad * 0.6, w + pad * 2, fs + pad * 1.8);
    g.fillStyle = ctx.palette.fg;
    g.fillText(label, m, ctx.height - m);
  },
  random: (seed) => {
    const rnd = mulberry32(seed);
    const base = CURATED[(rnd() * CURATED.length) | 0];
    const tr = { zoom: 0.97, rotación: 2, desplazamientoX: 0, desplazamientoY: 0, ...base.transform };
    return {
      ...base,
      transform: {
        ...tr,
        rotación: Math.round((tr.rotación + (rnd() * 2 - 1) * 2) * 10) / 10,
        zoom: Math.round((tr.zoom + (rnd() * 2 - 1) * 0.01) * 1000) / 1000,
      },
    };
  },
  actions: {
    limpiar: () => ({ reset: true }),
  },
  dispose: () => {},
};

export default env;
