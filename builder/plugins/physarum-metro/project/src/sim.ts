// Physarum (Jeff Jones 2010) en WebGL2: agentes en textura RGBA32F (ping-pong),
// depósito con gl.POINTS + blending aditivo sobre un rastro RGBA16F,
// difusión 3×3 + decaimiento + comida (estaciones). Display: rastro → 1 bit con dither ordenado.

export interface SimParams {
  agents: number; // cantidad de agentes
  sensorAngle: number; // grados
  turnAngle: number; // grados
  sensorDist: number; // px de simulación
  stepSize: number; // px por paso
  deposit: number;
  decay: number; // fracción que se pierde por paso (0..1)
  diffuse: number; // 0..1 mezcla con el promedio 3×3
  food: number; // depósito de las estaciones por paso
  foodRadius: number; // px
  spawn: "estaciones" | "uniforme";
  spawnRadius: number; // px
  seed: number;
  leash: number; // fracción del ancho: los agentes más lejos que esto de toda estación reaparecen (0 = sin correa)
  respawn: number; // prob. por paso de volver a una estación al azar (no está en Jones 2010)
}

const VS_QUAD = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;

const FS_AGENTS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D agents; uniform sampler2D trail; uniform sampler2D stations; uniform sampler2D food; uniform int NS; uniform float respawn;
uniform vec2 simSize; uniform float SA, RA, SO, SS; uniform uint seed; uniform uint stepN; uniform int AW; uniform int N;
out vec4 o;
uint hash(uint x){ x ^= x>>16; x *= 0x7feb352dU; x ^= x>>15; x *= 0x846ca68bU; x ^= x>>16; return x; }
float sense(vec2 pos, float ang){ vec2 q = pos + vec2(cos(ang), sin(ang))*SO; return texture(trail, q/simSize).r; }
void main(){
  ivec2 ij = ivec2(gl_FragCoord.xy);
  vec4 a = texelFetch(agents, ij, 0);
  int id = ij.y*AW + ij.x;
  if (id >= N) { o = a; return; }
  vec2 pos = a.xy; float ang = a.z;
  uint h = hash(uint(id)*2654435761u ^ hash(stepN*9277u + seed));
  float r = float(h) / 4294967295.0;
  float F = sense(pos, ang), L = sense(pos, ang + SA), R = sense(pos, ang - SA);
  if (F > L && F > R) {}
  else if (F < L && F < R) { ang += (r < 0.5 ? 1.0 : -1.0) * RA; }
  else if (L > R) { ang += RA; }
  else if (R > L) { ang -= RA; }
  vec2 np = pos + vec2(cos(ang), sin(ang))*SS;
  uint h2 = hash(h ^ 0x9e3779b9u);
  bool outside = texture(food, np/simSize).g < 0.5;
  if (NS > 0 && (outside || float(h2) / 4294967295.0 < respawn)) {
    uint h3 = hash(h2 + 17u);
    np = texelFetch(stations, ivec2(int(h3 % uint(NS)), 0), 0).xy; ang = float(hash(h3)) / 4294967295.0 * 6.2831853;
  }
  if (np.x < 1.0 || np.y < 1.0 || np.x > simSize.x-1.0 || np.y > simSize.y-1.0) {
    np = clamp(np, vec2(1.0), simSize-1.0); ang = r*6.2831853;
  }
  o = vec4(np, mod(ang, 6.2831853), a.w);
}`;

const VS_DEPOSIT = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D agents; uniform int AW; uniform vec2 simSize;
void main(){ int id = gl_VertexID; vec4 a = texelFetch(agents, ivec2(id % AW, id / AW), 0);
  gl_Position = vec4((a.xy/simSize)*2.0-1.0, 0.0, 1.0); gl_PointSize = 1.0; }`;
const FS_DEPOSIT = `#version 300 es
precision highp float; uniform float dep; out vec4 o; void main(){ o = vec4(dep, 0.0, 0.0, 1.0); }`;

const FS_DIFFUSE = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D trail; uniform sampler2D food; uniform float decay, diffuse, foodAmt;
out vec4 o;
void main(){
  ivec2 ij = ivec2(gl_FragCoord.xy); ivec2 mx = textureSize(trail, 0) - 1;
  float c = texelFetch(trail, ij, 0).r; float s = 0.0;
  for (int dy=-1; dy<=1; dy++) for (int dx=-1; dx<=1; dx++) s += texelFetch(trail, clamp(ij+ivec2(dx,dy), ivec2(0), mx), 0).r;
  s /= 9.0;
  float v = mix(c, s, diffuse) * (1.0 - decay) + texelFetch(food, ij, 0).r * foodAmt;
  o = vec4(min(v, 60000.0), 0.0, 0.0, 1.0);
}`;

const FS_DISPLAY = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D trail; uniform vec2 outSize; uniform float scale, gamma, cell; uniform vec3 fg; uniform int mode;
out vec4 o;
float bayer(ivec2 p){ int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return (float(m[(p.y&3)*4+(p.x&3)])+0.5)/16.0; }
void main(){
  vec2 uv = vec2(gl_FragCoord.x/outSize.x, 1.0 - gl_FragCoord.y/outSize.y);
  float t = texture(trail, uv).r;
  float n = pow(1.0 - exp(-t/scale), gamma);
  float th = mode == 0 ? bayer(ivec2(floor(vec2(gl_FragCoord.x, outSize.y - gl_FragCoord.y)/cell))) : 0.5;
  float on = n > th ? 1.0 : 0.0;
  o = vec4(fg*on, on);
}`;

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link");
  return p;
}

export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AW = 1024;

export class PhysarumSim {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  W = 0; H = 0; AH = 0; N = 0;
  step = 0;
  private progs: Record<string, WebGLProgram> = {};
  private uni = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private agentTex: WebGLTexture[] = [];
  private agentFb: WebGLFramebuffer[] = [];
  private trailTex: WebGLTexture[] = [];
  private trailFb: WebGLFramebuffer[] = [];
  private foodTex: WebGLTexture | null = null;
  private stTex: WebGLTexture | null = null;
  private NS = 0;
  private vao: WebGLVertexArrayObject;
  private a = 0; private t = 0;
  params!: SimParams;

  constructor() {
    this.canvas = document.createElement("canvas");
    const gl = this.canvas.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, alpha: true });
    if (!gl) throw new Error("WebGL2 no disponible");
    if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("Falta EXT_color_buffer_float");
    gl.getExtension("EXT_float_blend");
    this.gl = gl;
    this.vao = gl.createVertexArray()!;
    this.progs.agents = compile(gl, VS_QUAD, FS_AGENTS);
    this.progs.deposit = compile(gl, VS_DEPOSIT, FS_DEPOSIT);
    this.progs.diffuse = compile(gl, VS_QUAD, FS_DIFFUSE);
    this.progs.display = compile(gl, VS_QUAD, FS_DISPLAY);
  }

  private u(p: WebGLProgram, name: string) {
    let m = this.uni.get(p);
    if (!m) { m = new Map(); this.uni.set(p, m); }
    if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name));
    return m.get(name)!;
  }

  private tex(w: number, h: number, internal: number, format: number, type: number, data: ArrayBufferView | null, linear: boolean) {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
    const f = linear ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  private fb(t: WebGLTexture) {
    const gl = this.gl;
    const f = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error("framebuffer incompleto " + st);
    return f;
  }

  private free() {
    const gl = this.gl;
    for (const t of [...this.agentTex, ...this.trailTex]) gl.deleteTexture(t);
    for (const f of [...this.agentFb, ...this.trailFb]) gl.deleteFramebuffer(f);
    if (this.foodTex) gl.deleteTexture(this.foodTex);
    if (this.stTex) gl.deleteTexture(this.stTex);
    this.agentTex = []; this.agentFb = []; this.trailTex = []; this.trailFb = [];
  }

  /** stations: coordenadas en px de simulación (y hacia abajo). */
  reset(W: number, H: number, stations: [number, number][], p: SimParams) {
    const gl = this.gl;
    this.free();
    this.params = { ...p };
    this.W = W; this.H = H; this.step = 0;
    this.N = Math.max(1, Math.round(p.agents));
    this.AH = Math.ceil(this.N / AW);
    const rnd = mulberry32(p.seed >>> 0);
    const data = new Float32Array(AW * this.AH * 4);
    const S = stations.length;
    for (let i = 0; i < this.N; i++) {
      let x: number, y: number;
      if (p.spawn === "estaciones" && S > 0) {
        const s = stations[i % S];
        const r = p.spawnRadius * Math.sqrt(-2 * Math.log(rnd() + 1e-9));
        const th = rnd() * Math.PI * 2;
        x = s[0] + Math.cos(th) * r; y = s[1] + Math.sin(th) * r;
      } else { x = rnd() * W; y = rnd() * H; }
      data[i * 4] = Math.min(W - 1.5, Math.max(1.5, x));
      data[i * 4 + 1] = Math.min(H - 1.5, Math.max(1.5, y));
      data[i * 4 + 2] = rnd() * Math.PI * 2;
      data[i * 4 + 3] = 1;
    }
    for (let k = 0; k < 2; k++) {
      this.agentTex[k] = this.tex(AW, this.AH, gl.RGBA32F, gl.RGBA, gl.FLOAT, k === 0 ? data : null, false);
      this.agentFb[k] = this.fb(this.agentTex[k]);
      this.trailTex[k] = this.tex(W, H, gl.RGBA16F, gl.RGBA, gl.FLOAT, null, true);
      this.trailFb[k] = this.fb(this.trailTex[k]);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    }
    const food = new Float32Array(W * H * 4);
    const Lp = p.leash > 0 ? p.leash * W : Math.max(W, H) * 2, L2 = Lp * Lp;
    for (let i = 1; i < W * H * 4; i += 4) food[i] = p.leash > 0 ? 0 : 1;
    if (p.leash > 0) for (const [sx, sy] of stations) {
      for (let y = Math.max(0, Math.floor(sy - Lp)); y <= Math.min(H - 1, Math.ceil(sy + Lp)); y++) for (let x = Math.max(0, Math.floor(sx - Lp)); x <= Math.min(W - 1, Math.ceil(sx + Lp)); x++) {
        if ((x + 0.5 - sx) ** 2 + (y + 0.5 - sy) ** 2 <= L2) food[(y * W + x) * 4 + 1] = 1;
      }
    }
    const R = p.foodRadius, R2 = R * R;
    for (const [sx, sy] of stations) {
      for (let y = Math.floor(sy - R); y <= Math.ceil(sy + R); y++) for (let x = Math.floor(sx - R); x <= Math.ceil(sx + R); x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        if ((x + 0.5 - sx) ** 2 + (y + 0.5 - sy) ** 2 <= R2) food[(y * W + x) * 4] = 1;
      }
    }
    this.foodTex = this.tex(W, H, gl.RGBA16F, gl.RGBA, gl.FLOAT, food, false);
    this.NS = stations.length;
    const st = new Float32Array(Math.max(1, this.NS) * 4);
    stations.forEach(([x, y], i) => { st[i * 4] = Math.min(W - 1.5, Math.max(1.5, x)); st[i * 4 + 1] = Math.min(H - 1.5, Math.max(1.5, y)); });
    this.stTex = this.tex(Math.max(1, this.NS), 1, gl.RGBA32F, gl.RGBA, gl.FLOAT, st, false);
    this.a = 0; this.t = 0;
  }

  setLive(p: Partial<SimParams>) { Object.assign(this.params, p); }

  run(nSteps: number) {
    const gl = this.gl, p = this.params;
    gl.bindVertexArray(this.vao);
    const d2r = Math.PI / 180;
    for (let s = 0; s < nSteps; s++) {
      // 1. agentes
      let pr = this.progs.agents; gl.useProgram(pr);
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.agentFb[1 - this.a]);
      gl.viewport(0, 0, AW, this.AH);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.agentTex[this.a]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.trailTex[this.t]);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.stTex);
      gl.uniform1i(this.u(pr, "agents"), 0); gl.uniform1i(this.u(pr, "trail"), 1); gl.uniform1i(this.u(pr, "stations"), 2);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.foodTex);
      gl.uniform1i(this.u(pr, "food"), 3);
      gl.uniform1i(this.u(pr, "NS"), this.NS); gl.uniform1f(this.u(pr, "respawn"), p.respawn);
      gl.uniform2f(this.u(pr, "simSize"), this.W, this.H);
      gl.uniform1f(this.u(pr, "SA"), p.sensorAngle * d2r); gl.uniform1f(this.u(pr, "RA"), p.turnAngle * d2r);
      gl.uniform1f(this.u(pr, "SO"), p.sensorDist); gl.uniform1f(this.u(pr, "SS"), p.stepSize);
      gl.uniform1ui(this.u(pr, "seed"), p.seed >>> 0); gl.uniform1ui(this.u(pr, "stepN"), this.step >>> 0);
      gl.uniform1i(this.u(pr, "AW"), AW); gl.uniform1i(this.u(pr, "N"), this.N);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.a = 1 - this.a;
      // 2. depósito
      pr = this.progs.deposit; gl.useProgram(pr);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFb[this.t]);
      gl.viewport(0, 0, this.W, this.H);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.agentTex[this.a]);
      gl.uniform1i(this.u(pr, "agents"), 0); gl.uniform1i(this.u(pr, "AW"), AW);
      gl.uniform2f(this.u(pr, "simSize"), this.W, this.H); gl.uniform1f(this.u(pr, "dep"), p.deposit);
      gl.drawArrays(gl.POINTS, 0, this.N);
      gl.disable(gl.BLEND);
      // 3. difusión + decaimiento + comida
      pr = this.progs.diffuse; gl.useProgram(pr);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFb[1 - this.t]);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.trailTex[this.t]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.foodTex);
      gl.uniform1i(this.u(pr, "trail"), 0); gl.uniform1i(this.u(pr, "food"), 1);
      gl.uniform1f(this.u(pr, "decay"), p.decay); gl.uniform1f(this.u(pr, "diffuse"), p.diffuse);
      gl.uniform1f(this.u(pr, "foodAmt"), p.food);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.t = 1 - this.t;
      this.step++;
    }
  }

  /** Dibuja el rastro en 1 bit (color fg, alfa) en el canvas GL al tamaño w×h. */
  display(w: number, h: number, fg: [number, number, number], scale: number, gamma: number, cell: number, mode: 0 | 1) {
    const gl = this.gl;
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const pr = this.progs.display; gl.useProgram(pr);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.trailTex[this.t]);
    gl.uniform1i(this.u(pr, "trail"), 0);
    gl.uniform2f(this.u(pr, "outSize"), w, h);
    gl.uniform1f(this.u(pr, "scale"), scale); gl.uniform1f(this.u(pr, "gamma"), gamma);
    gl.uniform1f(this.u(pr, "cell"), cell); gl.uniform3f(this.u(pr, "fg"), fg[0], fg[1], fg[2]);
    gl.uniform1i(this.u(pr, "mode"), mode);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Lee el rastro (canal R) a CPU. Fila 0 = arriba (y de simulación). */
  readTrail(): Float32Array {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFb[this.t]);
    const buf = new Float32Array(this.W * this.H * 4);
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.FLOAT, buf);
    const out = new Float32Array(this.W * this.H);
    for (let i = 0; i < out.length; i++) out[i] = buf[i * 4];
    return out;
  }
}
