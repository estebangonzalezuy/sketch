import * as THREE from 'three';
import type { RenderContext } from '../../core/tool';
import { blueNoise } from './bluenoise';
import { Quad, shader, sized } from './gl';
import { FULL_PALETTE, guardColor, hexToRgb, luma, pairInks, rgbToOklab, type RGB } from './palette';
import { BLUR_FRAG, COMP_FRAG, FINAL_FRAG, MODE_COMP_FRAG } from './shaders';

// El pipeline del entorno Spray (antes una app aparte): composición →
// airbrush separable a media resolución → final (color, estilo, cuantización a las tintas del par).

export const STYLES = ['spray', 'puntos', 'riso', 'pixel', 'líneas', 'stipple'] as const;
export type Style = (typeof STYLES)[number];

export interface Paint {
  style: string;
  airbrush: number;
  grain: number;
  boil: number;
  flatten: number;
  saturation: number;
  pale: number;
  wave: number;
  glass: number;
  chroma: number;
  glow: number;
  matrix: string;
  cell: number;
  brandMix: number;
}

export interface Colour {
  pair: string;
  invert: boolean;
  /** Paleta tMSC completa (fuera de pares locked). Sin esto, la pieza usa solo las 2 tintas. */
  full: boolean;
}

/** Lo que un modo le pide al pase final y a su composición. */
export interface ModeFrame {
  progress: number;
  fill: number;
  photo: number;
  reveal: number;
  gain: number;
  knife: { angle: number; phase: number; soft: number } | null;
  paper: number;
  sort: boolean;
}

export const modeFrame = (over: Partial<ModeFrame> = {}): ModeFrame => ({
  progress: 1,
  fill: 0,
  photo: 0,
  reveal: 0,
  gain: 1,
  knife: null,
  paper: 0,
  sort: false,
  ...over,
});

const v3 = () => new THREE.Vector3();
const set3 = (v: THREE.Vector3, c: RGB) => v.set(c[0], c[1], c[2]);

function blankTexture(): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  t.needsUpdate = true;
  return t;
}

export class SprayPipeline {
  private quad = new Quad();
  private blank = blankTexture();
  private blue: THREE.DataTexture;
  private comp: THREE.WebGLRenderTarget | null = null;
  private blurH: THREE.WebGLRenderTarget | null = null;
  private blurV: THREE.WebGLRenderTarget | null = null;

  private photo = shader(COMP_FRAG, {
    uA: { value: null },
    uB: { value: null },
    uField: { value: null },
    uText: { value: null },
    uCoverA: { value: new THREE.Vector2(1, 1) },
    uCoverB: { value: new THREE.Vector2(1, 1) },
    uHasB: { value: 0 },
    uFade: { value: 0 },
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uWave: { value: 0 },
    uHasText: { value: 0 },
    uBg: { value: v3() },
  });

  private mode = shader(MODE_COMP_FRAG, {
    uFig: { value: null },
    uCrisp: { value: null },
    uField: { value: null },
    uA: { value: null },
    uCoverA: { value: new THREE.Vector2(1, 1) },
    uHasA: { value: 0 },
    uBg: { value: v3() },
    uFg: { value: v3() },
    uProgress: { value: 1 },
    uFill: { value: 0 },
    uPhoto: { value: 0 },
    uReveal: { value: 0 },
    uGain: { value: 1 },
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uWave: { value: 0 },
  });

  private blur = shader(BLUR_FRAG, {
    uTex: { value: null },
    uStep: { value: new THREE.Vector2() },
    uSigma: { value: 0 },
    uSigmaA: { value: 0 },
  });

  private final = shader(FINAL_FRAG, {
    uComp: { value: null },
    uBlur: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uResScale: { value: 1 },
    uSigma: { value: 0 },
    uSigmaA: { value: 0 },
    uSat: { value: 1 },
    uPale: { value: 0 },
    uGrain: { value: 0 },
    uFlatten: { value: 7 },
    uBrandMix: { value: 1 },
    uTick: { value: 0 },
    uChroma: { value: 0 },
    uGlow: { value: 0 },
    uGlass: { value: 0 },
    uStrict: { value: 1 },
    uStyle: { value: 0 },
    uPaper: { value: v3() },
    uTextColor: { value: v3() },
    uPal: { value: Array.from({ length: 16 }, v3) },
    uPalLab: { value: Array.from({ length: 16 }, v3) },
    uPalN: { value: 0 },
    uInks: { value: Array.from({ length: 3 }, v3) },
    uInkN: { value: 0 },
    uRisoPaper: { value: v3() },
    uGuardA: { value: v3() },
    uGuardB: { value: v3() },
    uBlue: { value: null },
    uMatrix: { value: 1 },
    uCell: { value: 2 },
    uKnife: { value: new THREE.Vector4(0, 0, 0, -1) },
    uSort: { value: 0 },
    uPaperSpeck: { value: 0 },
  });

  constructor() {
    this.blue = new THREE.DataTexture(blueNoise(64), 64, 64, THREE.RedFormat, THREE.UnsignedByteType);
    this.blue.minFilter = THREE.NearestFilter;
    this.blue.magFilter = THREE.NearestFilter;
    this.blue.unpackAlignment = 1;
    this.blue.needsUpdate = true;
  }

  get quadRef(): Quad {
    return this.quad;
  }

  private targets(ctx: RenderContext) {
    const hw = Math.max(1, Math.round(ctx.width / 2));
    const hh = Math.max(1, Math.round(ctx.height / 2));
    this.comp = sized(this.comp, ctx.width, ctx.height);
    this.blurH = sized(this.blurH, hw, hh);
    this.blurV = sized(this.blurV, hw, hh, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    return { comp: this.comp, blurH: this.blurH, blurV: this.blurV };
  }

  /** Spray de fotos: fuente A (y B para el morph), texto opcional desde otra capa. */
  renderPhoto(
    ctx: RenderContext,
    o: { a: THREE.Texture | null; b: THREE.Texture | null; morph: number; type: THREE.Texture | null; textEffect: number; field: THREE.Texture | null; paint: Paint; colour: Colour },
  ): void {
    const { comp } = this.targets(ctx);
    const inks = pairInks(o.colour.pair, o.colour.invert);
    const u = this.photo.uniforms;
    u.uA.value = o.a ?? this.blank;
    u.uB.value = o.b ?? this.blank;
    u.uHasB.value = o.b ? 1 : 0;
    u.uFade.value = o.morph;
    u.uField.value = o.field ?? this.blank;
    u.uText.value = o.type ?? this.blank;
    u.uHasText.value = o.type ? 1 : 0;
    u.uTime.value = ctx.time;
    u.uAspect.value = ctx.aspect;
    u.uWave.value = o.paint.wave;
    set3(u.uBg.value, inks.field);
    this.quad.draw(ctx.renderer, this.photo, comp);
    this.finish(ctx, o.paint, o.colour, null, !!o.type, o.textEffect);
  }

  /** Modo moodboard: figura (densidad) y capa nítida dibujadas por la tool, foto opcional. */
  renderMode(
    ctx: RenderContext,
    o: { fig: THREE.Texture; crisp: THREE.Texture; photo: THREE.Texture | null; frame: ModeFrame; field: THREE.Texture | null; paint: Paint; colour: Colour },
  ): void {
    const { comp } = this.targets(ctx);
    const inks = pairInks(o.colour.pair, o.colour.invert);
    const u = this.mode.uniforms;
    u.uFig.value = o.fig;
    u.uCrisp.value = o.crisp;
    u.uField.value = o.field ?? this.blank;
    u.uA.value = o.photo ?? this.blank;
    u.uHasA.value = o.photo ? 1 : 0;
    set3(u.uBg.value, inks.field);
    set3(u.uFg.value, inks.figure);
    u.uProgress.value = o.frame.progress;
    u.uFill.value = o.frame.fill;
    u.uPhoto.value = o.frame.photo;
    u.uReveal.value = o.frame.reveal;
    u.uGain.value = o.frame.gain;
    u.uTime.value = ctx.time;
    u.uAspect.value = ctx.aspect;
    u.uWave.value = o.paint.wave;
    this.quad.draw(ctx.renderer, this.mode, comp);
    this.finish(ctx, o.paint, o.colour, o.frame, true, 0);
  }

  private finish(ctx: RenderContext, paint: Paint, colour: Colour, mode: ModeFrame | null, hasText: boolean, textEffect: number): void {
    const { comp, blurH, blurV } = this.targets(ctx);
    const renderer = ctx.renderer;
    // Airbrush: sigma en px de la media resolución.
    const sigma = paint.airbrush * 4.5 * ctx.unit * 0.5;
    const sigmaA = hasText ? sigma * textEffect : 0;
    const b = this.blur.uniforms;
    b.uSigma.value = sigma;
    b.uSigmaA.value = sigmaA;
    b.uTex.value = comp.texture;
    b.uStep.value.set(1 / blurH.width, 0);
    this.quad.draw(renderer, this.blur, blurH);
    b.uTex.value = blurH.texture;
    b.uStep.value.set(0, 1 / blurV.height);
    this.quad.draw(renderer, this.blur, blurV);

    const inks = pairInks(colour.pair, colour.invert);
    const strict = !colour.full;
    const palette = strict ? [inks.field, inks.figure] : FULL_PALETTE.map(hexToRgb).map((c) => guardColor(c, inks.figure));
    const f = this.final.uniforms;
    f.uComp.value = comp.texture;
    f.uBlur.value = blurV.texture;
    f.uBlue.value = this.blue;
    f.uRes.value.set(ctx.width, ctx.height);
    f.uResScale.value = ctx.unit;
    f.uSigma.value = sigma;
    f.uSigmaA.value = sigmaA;
    f.uSat.value = paint.saturation;
    f.uPale.value = paint.pale;
    f.uGrain.value = paint.grain;
    f.uFlatten.value = paint.flatten;
    f.uBrandMix.value = strict ? 1 : paint.brandMix;
    // Hervor: la semilla del grano cambia 24 × Boil veces por segundo, a partir del tiempo del clip.
    f.uTick.value = paint.boil > 0 ? Math.floor(ctx.time * paint.boil * 24) : 0;
    f.uChroma.value = paint.chroma;
    f.uGlow.value = paint.glow;
    f.uGlass.value = paint.glass;
    f.uStrict.value = strict ? 1 : 0;
    f.uStyle.value = Math.max(0, (STYLES as readonly string[]).indexOf(paint.style));
    set3(f.uPaper.value, inks.field);
    set3(f.uTextColor.value, inks.figure);
    f.uPalN.value = Math.min(16, palette.length);
    palette.slice(0, 16).forEach((c, i) => {
      set3(f.uPal.value[i], c);
      set3(f.uPalLab.value[i], rgbToOklab(c));
    });
    // Riso: el papel es la tinta más clara; las tintas, la más oscura y las más saturadas.
    const sorted = [...palette].sort((x, y) => luma(y) - luma(x));
    const paper = sorted[0];
    const sat = (c: RGB) => Math.max(...c) - Math.min(...c);
    const rest = sorted.slice(1);
    const darkest = rest[rest.length - 1];
    const risoInks = [darkest, ...rest.filter((c) => c !== darkest).sort((x, y) => sat(y) - sat(x))].filter(Boolean).slice(0, 3);
    f.uInkN.value = risoInks.length;
    risoInks.forEach((c, i) => set3(f.uInks.value[i], c));
    set3(f.uRisoPaper.value, paper);
    set3(f.uGuardA.value, inks.field);
    set3(f.uGuardB.value, inks.figure);
    f.uMatrix.value = paint.matrix === 'bayer' ? 0 : 1;
    f.uCell.value = paint.cell;
    f.uSort.value = mode?.sort ? 1 : 0;
    f.uPaperSpeck.value = mode?.paper ?? 0;
    const k = mode?.knife;
    if (k) {
      const a = (k.angle * Math.PI) / 180;
      const nx = -Math.sin(a);
      const ny = Math.cos(a);
      const extent = Math.abs(nx) * ctx.aspect + Math.abs(ny);
      f.uKnife.value.set(nx, ny, (k.phase - 0.5) * extent, k.soft);
    } else {
      f.uKnife.value.set(0, 0, 0, -1);
    }
    this.quad.draw(renderer, this.final, ctx.target);
  }

  dispose(): void {
    [this.comp, this.blurH, this.blurV].forEach((t) => t?.dispose());
    [this.photo, this.mode, this.blur, this.final].forEach((m) => m.dispose());
    this.blank.dispose();
    this.blue.dispose();
    this.quad.dispose();
  }
}
