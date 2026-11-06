import * as THREE from 'three';
import { defineTool, type Params, type RenderContext } from '../../core/tool';
import animations from './animations';
import { buildLines, charAt, PATTERN_CHARS, scrambleClock, type Line } from './content';
import presets from './presets.json';

const DESIGN = 1080; // lado corto de referencia: la grilla es la misma en toda escala

const num = (p: Params, id: string) => p[id] as number;

const hue2rgb = (p: number, q: number, t: number) => {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
};

const ALPHA = { dark: [] as string[], light: [] as string[] };
for (let i = 0; i <= 100; i++) {
  ALPHA.dark[i] = `rgba(255, 255, 255, ${(i / 100).toFixed(2)})`;
  ALPHA.light[i] = `rgba(0, 0, 0, ${(i / 100).toFixed(2)})`;
}
const PATTERN = { dark: 'rgba(255, 255, 255, 0.08)', light: 'rgba(0, 0, 0, 0.1)' };

/** Color del modo color: saturación, luz y contraste, igual que el original. Devuelve r, g, b en 0…255. */
function shade(r: number, g: number, b: number, p: Params, out: [number, number, number]) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  const newS = Math.min(1, s * num(p, 'saturationBoost'));
  let newL = l ** (1 / num(p, 'lightnessAdjust'));
  newL += num(p, 'lightnessOffset') * newL;
  let sr = newL * 255;
  let sg = sr;
  let sb = sr;
  if (newS !== 0) {
    const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
    const pp = 2 * newL - q;
    sr = hue2rgb(pp, q, h + 1 / 3) * 255;
    sg = hue2rgb(pp, q, h) * 255;
    sb = hue2rgb(pp, q, h - 1 / 3) * 255;
  }
  const contrast = num(p, 'contrast');
  const finish = (v: number) => Math.max(0, Math.min(255, Math.round(128 + (v - 128) * contrast)));
  out[0] = finish(sr);
  out[1] = finish(sg);
  out[2] = finish(sb);
}

export default defineTool({
  id: 'ascii',
  name: 'ASCII',
  version: 1,
  kind: 'effect',
  inputs: [{ id: 'source', label: 'Fuente', required: true }],
  presets,
  animations,
  params: {
    colorMode: { kind: 'select', default: 'dark', options: ['dark', 'light', 'color'], animate: 'frame', group: 'Apariencia' },
    family: { kind: 'select', default: 'KMR Apparat', options: ['KMR Apparat', 'IBM Plex Mono', 'Geist Mono'], animate: 'none', group: 'Apariencia' },
    chars: { kind: 'text', default: '@', label: 'caracteres', animate: 'rebuild', group: 'Apariencia' },
    showPattern: { kind: 'boolean', default: false, label: 'mostrar patrón', animate: 'frame', group: 'Apariencia' },
    invert: { kind: 'boolean', default: false, animate: 'frame', group: 'Apariencia' },

    fontSize: { kind: 'number', default: 10, min: 6, max: 30, step: 1, animate: 'rebuild', group: 'Grilla' },
    letterSpacing: { kind: 'number', default: 1.3, min: 1, max: 3, step: 0.01, animate: 'rebuild', group: 'Grilla' },
    lineHeight: { kind: 'number', default: 1, min: 0.8, max: 3, step: 0.01, animate: 'rebuild', group: 'Grilla' },
    fit: { kind: 'number', default: 0.95, min: 0.1, max: 1, step: 0.01, label: 'ajuste a cuadro', animate: 'frame', group: 'Grilla' },
    alignment: { kind: 'select', default: 'center', options: ['left', 'center', 'right'], animate: 'frame', group: 'Grilla' },

    contrast: { kind: 'number', default: 1.5, min: 0, max: 4, step: 0.01, animate: 'frame', group: 'Color' },
    saturationBoost: { kind: 'number', default: 1.5, min: 0, max: 4, step: 0.01, animate: 'frame', group: 'Color' },
    luminanceThreshold: { kind: 'number', default: 0.05, min: 0, max: 1, step: 0.01, animate: 'frame', group: 'Color' },
    lightnessAdjust: { kind: 'number', default: 0.55, min: 0.1, max: 2, step: 0.01, animate: 'frame', group: 'Color' },
    lightnessOffset: { kind: 'number', default: 0.25, min: 0, max: 1, step: 0.01, animate: 'frame', group: 'Color' },

    scrambleSpeed: { kind: 'number', default: 40, min: 10, max: 500, step: 1, label: 'ms por step', animate: 'none', group: 'Scramble' },
  },
  create() {
    const canvas = document.createElement('canvas');
    const c = canvas.getContext('2d', { willReadFrequently: true })!; // raster por CPU: por GPU varía entre corridas
    const texture = new THREE.CanvasTexture(canvas);
    texture.premultiplyAlpha = true;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;

    // Grilla reducida: la entrada a un target pequeño, leída a la CPU.
    const reduced = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, generateMipmaps: false });
    const material = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `uniform sampler2D uTex; varying vec2 vUv; void main() { gl_FragColor = texture2D(uTex, vUv); }`,
      uniforms: { uTex: { value: null } },
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    const scene = new THREE.Scene();
    scene.add(quad);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    let pixels = new Uint8Array(4);

    let charRatio = 0.6; // ancho de la "M" por píxel de tamaño
    let lines: Line[] = [];
    let linesKey = '';
    const colors = new Map<number, string>();

    const colorString = (r: number, g: number, b: number) => {
      const key = (r << 16) | (g << 8) | b;
      let color = colors.get(key);
      if (!color) {
        color = `rgb(${r}, ${g}, ${b})`;
        colors.set(key, color);
      }
      return color;
    };

    return {
      async prepare(p: Params) {
        await document.fonts.load(`100px "${p.family}"`);
        c.font = `100px "${p.family}"`;
        charRatio = c.measureText('M').width / 100;
      },
      render(p: Params, ctx: RenderContext) {
        if (canvas.width !== ctx.width || canvas.height !== ctx.height) {
          canvas.width = ctx.width;
          canvas.height = ctx.height;
          texture.dispose(); // el tamaño de una textura en la GPU es fijo: hay que recrearla
        }
        c.clearRect(0, 0, ctx.width, ctx.height);

        // Todo en unidades de diseño: píxeles a un lado corto de 1080.
        const designW = DESIGN * Math.max(1, ctx.aspect);
        const designH = DESIGN * Math.max(1, 1 / ctx.aspect);
        const size = num(p, 'fontSize');
        const baseCharWidth = size * charRatio;
        const cellW = baseCharWidth * num(p, 'letterSpacing');
        const cellH = size * num(p, 'lineHeight');
        const columns = Math.floor(designW / cellW);
        const rows = Math.floor(designH / cellH);
        const mode = p.colorMode as 'dark' | 'light' | 'color';
        const density = String(p.chars) || '@';

        const key = [ctx.seed, rows, columns, mode === 'color' ? density : ''].join('|');
        if (key !== linesKey) {
          lines = buildLines(ctx.seed, rows, columns, mode === 'color' ? density : null);
          linesKey = key;
        }

        // Ubicación de la entrada, con el aspect del cuadro: las entradas ya vienen ajustadas a él.
        const fit = num(p, 'fit');
        const mediaW = designW * fit;
        const mediaH = designH * fit;
        const offsetX = p.alignment === 'left' ? 0 : p.alignment === 'right' ? designW - mediaW : (designW - mediaW) / 2;
        const offsetY = (designH - mediaH) / 2;
        const gridW = Math.ceil(mediaW / baseCharWidth);
        const gridH = Math.ceil(mediaH / size);

        const input = ctx.inputs.source ?? null;
        if (input) {
          if (reduced.width !== gridW || reduced.height !== gridH) {
            reduced.setSize(gridW, gridH);
            pixels = new Uint8Array(gridW * gridH * 4);
          }
          material.uniforms.uTex.value = input;
          ctx.renderer.setRenderTarget(reduced);
          ctx.renderer.render(scene, camera);
          ctx.renderer.readRenderTargetPixels(reduced, 0, 0, gridW, gridH, pixels);
        }

        const clock = scrambleClock(ctx.time * 1000, num(p, 'scrambleSpeed'), ctx.loop ? { ...ctx.loop, fps: ctx.fps } : null);
        const scramble = mode === 'color' ? density : PATTERN_CHARS;
        const threshold = num(p, 'luminanceThreshold');
        const invert = p.invert as boolean;
        const pattern = p.showPattern as boolean;
        const patternStyle = mode === 'dark' ? PATTERN.dark : PATTERN.light;
        const u = ctx.unit;
        const rgb: [number, number, number] = [0, 0, 0];

        c.font = `${size * u}px "${p.family}"`;
        c.textBaseline = 'top';

        for (let row = 0; row < lines.length; row++) {
          const line = lines[row];
          const y = row * cellH;
          const relY = y + cellH / 2 - offsetY;
          for (let col = 0; col < line.length; col++) {
            const cell = line[col];
            const x = col * cellW;
            const relX = x + cellW / 2 - offsetX;
            let drawn = false;

            if (input && relX >= 0 && relX < mediaW && relY >= 0 && relY < mediaH) {
              const gx = Math.floor((relX / mediaW) * gridW);
              const gy = gridH - 1 - Math.floor((relY / mediaH) * gridH); // readPixels va de abajo hacia arriba
              const i = (gy * gridW + gx) * 4;
              const a = pixels[i + 3];
              if (a > 20) {
                const k = 255 / a; // la entrada viene premultiplicada
                const r = Math.min(255, pixels[i] * k);
                const g = Math.min(255, pixels[i + 1] * k);
                const b = Math.min(255, pixels[i + 2] * k);
                const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                if (invert || luminance > threshold) {
                  drawn = true;
                  if (mode === 'color') {
                    shade(r, g, b, p, rgb);
                    c.fillStyle = colorString(rgb[0], rgb[1], rgb[2]);
                  } else {
                    const base = 0.15 + luminance * 0.85;
                    const alpha = (a / 255) * (invert ? Math.max(0.4, base) : base);
                    c.fillStyle = ALPHA[mode][Math.max(0, Math.min(100, Math.round(alpha * 100)))];
                  }
                }
              }
            }
            if (pattern && !drawn) {
              drawn = true;
              c.fillStyle = patternStyle;
            }
            if (drawn && !cell.isSpace) c.fillText(charAt(cell, ctx.seed, row, col, clock, scramble), x * u, y * u);
          }
        }

        texture.needsUpdate = true;
        ctx.blit(texture);
      },
      dispose() {
        texture.dispose();
        reduced.dispose();
        material.dispose();
        quad.geometry.dispose();
      },
    };
  },
});
