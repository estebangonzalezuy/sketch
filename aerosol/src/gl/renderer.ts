import { BLUR_FRAG, COMP_FRAG, FINAL_FRAG, SMEAR_FRAG, VERT } from './shaders';
import type { RGB } from '../palette';

interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

type Uniforms = Record<string, WebGLUniformLocation | null>;
interface Program {
  prog: WebGLProgram;
  u: Uniforms;
}

export const STYLES = ['spray', 'halftone', 'riso', 'pixel', 'lines'] as const;
export type Style = (typeof STYLES)[number];

export interface SourceRef {
  tex: WebGLTexture;
  aspect: number;
}

export interface FrameParams {
  a: SourceRef | null;
  b: SourceRef | null;
  fade: number;
  time: number;
  tick: number;
  hasText: boolean;
  textEffect: number;
  textColor: RGB;
  airbrush: number;
  saturation: number;
  pale: number;
  grain: number;
  flatten: number;
  brandMix: number;
  style: Style;
  paper: RGB;
  palette: RGB[];
  paletteLab: RGB[];
  inks: RGB[];
  risoPaper: RGB;
  wave: number;
  glass: number;
  chroma: number;
  glow: number;
}

export interface Stamp {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

const FIELD_LONG = 256;

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  readonly smearOk: boolean;
  private vao: WebGLVertexArrayObject;
  private pSmear: Program;
  private pComp: Program;
  private pBlur: Program;
  private pFinal: Program;
  private field: [Target, Target] | null = null;
  private comp: Target | null = null;
  private blurH: Target | null = null;
  private blurV: Target | null = null;
  private textTex: WebGLTexture;
  private blank: WebGLTexture;
  width = 0;
  height = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false,
      preserveDrawingBuffer: true, // el export lee el canvas con VideoFrame
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 no está disponible en este navegador.');
    this.gl = gl;
    this.smearOk = !!gl.getExtension('EXT_color_buffer_float');
    this.vao = gl.createVertexArray()!;
    this.pSmear = this.program(SMEAR_FRAG);
    this.pComp = this.program(COMP_FRAG);
    this.pBlur = this.program(BLUR_FRAG);
    this.pFinal = this.program(FINAL_FRAG);
    this.textTex = this.texture();
    this.blank = this.texture();
    gl.bindTexture(gl.TEXTURE_2D, this.blank);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.bindTexture(gl.TEXTURE_2D, this.textTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  }

  private program(frag: string): Program {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
    const u: Uniforms = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i)!;
      const name = info.name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(prog, info.name);
    }
    return { prog, u };
  }

  texture(): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  /** Sube una imagen, video o canvas (con y hacia arriba). */
  upload(tex: WebGLTexture, src: TexImageSource): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  uploadText(src: TexImageSource): void {
    this.upload(this.textTex, src);
  }

  deleteTexture(tex: WebGLTexture): void {
    this.gl.deleteTexture(tex);
  }

  private target(w: number, h: number, internal: number, format: number, type: number, mips = false): Target {
    const gl = this.gl;
    const tex = this.texture();
    if (mips) {
      const levels = Math.floor(Math.log2(Math.max(w, h))) + 1;
      gl.texStorage2D(gl.TEXTURE_2D, levels, internal, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    }
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo, w, h };
  }

  private free(t: Target | null): void {
    if (!t) return;
    this.gl.deleteTexture(t.tex);
    this.gl.deleteFramebuffer(t.fbo);
  }

  resize(w: number, h: number): void {
    if (w === this.width && h === this.height) return;
    const gl = this.gl;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    [this.comp, this.blurH, this.blurV].forEach((t) => this.free(t));
    this.field?.forEach((t) => this.free(t));
    this.comp = this.target(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    const hw = Math.max(1, Math.round(w / 2));
    const hh = Math.max(1, Math.round(h / 2));
    this.blurH = this.target(hw, hh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    this.blurV = this.target(hw, hh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, true);
    if (this.smearOk) {
      const s = FIELD_LONG / Math.max(w, h);
      const fw = Math.max(8, Math.round(w * s));
      const fh = Math.max(8, Math.round(h * s));
      this.field = [
        this.target(fw, fh, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT),
        this.target(fw, fh, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT),
      ];
    }
    this.resetSmear();
  }

  resetSmear(): void {
    const gl = this.gl;
    this.field?.forEach((t) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Relaja el campo y aplica los trazos del frame. radius en altos de cuadro. */
  updateSmear(decay: number, stamps: Stamp[], radius: number): void {
    if (!this.field) return;
    const gl = this.gl;
    const { prog, u } = this.pSmear;
    gl.useProgram(prog);
    gl.bindVertexArray(this.vao);
    gl.uniform1f(u.uRadius, radius);
    gl.uniform1f(u.uAspect, this.width / this.height);
    const passes = Math.max(1, stamps.length);
    for (let i = 0; i < passes; i++) {
      const s = stamps[i];
      const src: Target = this.field[0];
      const dst: Target = this.field[1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(u.uField, 0);
      gl.uniform1f(u.uDecay, i === 0 ? decay : 1);
      gl.uniform1f(u.uStamp, s ? 1 : 0);
      gl.uniform2f(u.uPos, s?.x ?? 0, s?.y ?? 0);
      gl.uniform2f(u.uDelta, s?.dx ?? 0, s?.dy ?? 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.field = [dst, src];
    }
  }

  private bind(unit: number, tex: WebGLTexture, loc: WebGLUniformLocation | null): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  }

  private coverScale(aspect: number): [number, number] {
    const f = this.width / this.height;
    return aspect > f ? [f / aspect, 1] : [1, aspect / f];
  }

  render(p: FrameParams): void {
    const gl = this.gl;
    if (!this.comp || !this.blurH || !this.blurV) return;
    const scale = Math.min(this.width, this.height) / 1080;
    gl.bindVertexArray(this.vao);

    // 1. Composición
    {
      const { prog, u } = this.pComp;
      gl.useProgram(prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.comp.fbo);
      gl.viewport(0, 0, this.comp.w, this.comp.h);
      this.bind(0, p.a?.tex ?? this.blank, u.uA);
      this.bind(1, p.b?.tex ?? this.blank, u.uB);
      this.bind(2, this.field ? this.field[0].tex : this.blank, u.uField);
      this.bind(3, this.textTex, u.uText);
      gl.uniform2f(u.uCoverA, ...this.coverScale(p.a?.aspect ?? 1));
      gl.uniform2f(u.uCoverB, ...this.coverScale(p.b?.aspect ?? 1));
      gl.uniform1f(u.uHasB, p.b ? 1 : 0);
      gl.uniform1f(u.uFade, p.fade);
      gl.uniform1f(u.uTime, p.time);
      gl.uniform1f(u.uAspect, this.width / this.height);
      gl.uniform1f(u.uWave, p.wave);
      gl.uniform1f(u.uHasText, p.hasText ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // 2. Airbrush (a media resolución). sigma en píxeles de la mitad.
    const sigma = p.airbrush * 4.5 * scale * 0.5;
    const sigmaA = sigma * p.textEffect;
    {
      const { prog, u } = this.pBlur;
      gl.useProgram(prog);
      gl.uniform1f(u.uSigma, sigma);
      gl.uniform1f(u.uSigmaA, p.hasText ? sigmaA : 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurH.fbo);
      gl.viewport(0, 0, this.blurH.w, this.blurH.h);
      this.bind(0, this.comp.tex, u.uTex);
      gl.uniform2f(u.uStep, 1 / this.blurH.w, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurV.fbo);
      this.bind(0, this.blurH.tex, u.uTex);
      gl.uniform2f(u.uStep, 0, 1 / this.blurV.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (p.glow > 0) {
        gl.bindTexture(gl.TEXTURE_2D, this.blurV.tex);
        gl.generateMipmap(gl.TEXTURE_2D);
      }
    }

    // 3. Final a pantalla
    {
      const { prog, u } = this.pFinal;
      gl.useProgram(prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.width, this.height);
      this.bind(0, this.comp.tex, u.uComp);
      this.bind(1, this.blurV.tex, u.uBlur);
      gl.uniform2f(u.uRes, this.width, this.height);
      gl.uniform1f(u.uResScale, scale);
      gl.uniform1f(u.uSigma, sigma);
      gl.uniform1f(u.uSigmaA, p.hasText ? sigmaA : 0);
      gl.uniform1f(u.uSat, p.saturation);
      gl.uniform1f(u.uPale, p.pale);
      gl.uniform1f(u.uGrain, p.grain);
      gl.uniform1f(u.uFlatten, p.flatten);
      gl.uniform1f(u.uBrandMix, p.brandMix);
      gl.uniform1f(u.uTick, p.tick);
      gl.uniform1f(u.uChroma, p.chroma);
      gl.uniform1f(u.uGlow, p.glow);
      gl.uniform1f(u.uGlass, p.glass);
      gl.uniform1i(u.uStyle, Math.max(0, STYLES.indexOf(p.style)));
      gl.uniform3f(u.uPaper, ...p.paper);
      gl.uniform3f(u.uTextColor, ...p.textColor);
      const n = Math.min(16, p.palette.length);
      gl.uniform1i(u.uPalN, n);
      if (n > 0) {
        gl.uniform3fv(u.uPal, p.palette.slice(0, n).flat());
        gl.uniform3fv(u.uPalLab, p.paletteLab.slice(0, n).flat());
      }
      const k = Math.min(3, p.inks.length);
      gl.uniform1i(u.uInkN, k);
      if (k > 0) gl.uniform3fv(u.uInks, p.inks.slice(0, k).flat());
      gl.uniform3f(u.uRisoPaper, ...p.risoPaper);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }
}
