import * as THREE from 'three';
import { defineTool, type Params, type RenderContext } from '../../core/tool';
import animations from './animations';
import presets from './presets.json';

const FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uResolution;
uniform float uCell;
uniform int uMode;
uniform float uThreshold;
uniform float uContrast;
uniform float uMixAmount;
uniform vec3 uInk;
uniform vec3 uGround;
uniform float uGroundAlpha;
varying vec2 vUv;

// Bayer 8×8 por bits: no necesita tabla.
float bayer(ivec2 p) {
  int v = 0;
  int x = p.x & 7;
  int y = p.y & 7;
  for (int i = 0; i < 3; i++) {
    int xi = (x >> i) & 1;
    int yi = (y >> i) & 1;
    v |= ((xi ^ yi) << (5 - 2 * i)) | (yi << (4 - 2 * i));
  }
  return (float(v) + 0.5) / 64.0;
}

void main() {
  vec2 px = vUv * uResolution;
  vec2 cell = floor(px / uCell);
  vec4 sum = vec4(0.0);
  // Promedio del bloque, con la grilla anclada al origen.
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 at = (cell + (vec2(float(x), float(y)) + 0.5) / 4.0) * uCell / uResolution;
      sum += texture(uTex, clamp(at, 0.0, 1.0));
    }
  }
  vec4 mean = sum / 16.0;
  vec4 result = mean;
  if (uMode > 0) {
    vec3 straight = mean.a > 0.0 ? mean.rgb / mean.a : vec3(0.0);
    float l = dot(straight, vec3(0.2126, 0.7152, 0.0722)) * mean.a;
    l = clamp((l - 0.5) * uContrast + 0.5, 0.0, 1.0);
    float limit = uMode == 2 ? bayer(ivec2(cell)) : uThreshold;
    float on = step(limit, l);
    vec4 ground = vec4(uGround * uGroundAlpha, uGroundAlpha);
    result = mix(ground, vec4(uInk, 1.0), on);
  }
  vec4 original = texture(uTex, vUv);
  outColor = mix(original, result, uMixAmount);
}`;

export default defineTool({
  id: 'pixelate',
  name: 'Pixelado',
  version: 1,
  kind: 'effect',
  inputs: [{ id: 'source', label: 'Fuente', required: true }],
  presets,
  animations,
  params: {
    cell: { kind: 'number', default: 24, min: 1, max: 200, step: 1, interp: 'log', label: 'tamaño de celda', animate: 'frame', group: 'Efecto' },
    mode: { kind: 'select', default: 'mosaico', options: ['mosaico', 'umbral', 'bayer'], animate: 'frame', group: 'Efecto' },
    amount: { kind: 'number', default: 1, min: 0, max: 1, step: 0.001, label: 'mezcla', animate: 'frame', group: 'Efecto' },
    threshold: { kind: 'number', default: 0.5, min: 0, max: 1, step: 0.01, label: 'umbral', animate: 'frame', group: 'Efecto' },
    contrast: { kind: 'number', default: 1.2, min: 0.2, max: 4, step: 0.01, animate: 'frame', group: 'Efecto' },
    ink: { kind: 'color', default: '#FFFFFF', label: 'tinta', animate: 'frame', group: 'Color' },
    ground: { kind: 'color', default: '#000000', label: 'fondo', animate: 'frame', group: 'Color' },
    transparent: { kind: 'boolean', default: false, label: 'fondo transparente', animate: 'frame', group: 'Color' },
  },
  create() {
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: /* glsl */ `out vec2 vUv_; void main() { vUv_ = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `${FRAGMENT.replace('varying vec2 vUv;', 'in vec2 vUv_;\n#define vUv vUv_\nlayout(location = 0) out vec4 outColor;')}`,
      uniforms: {
        uTex: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uCell: { value: 24 },
        uMode: { value: 0 },
        uThreshold: { value: 0.5 },
        uContrast: { value: 1 },
        uMixAmount: { value: 1 },
        uInk: { value: new THREE.Vector3(1, 1, 1) },
        uGround: { value: new THREE.Vector3() },
        uGroundAlpha: { value: 1 },
      },
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    const scene = new THREE.Scene();
    scene.add(quad);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const rgb = (hex: string, out: THREE.Vector3) => {
      const n = parseInt(hex.slice(1), 16);
      out.set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    };

    return {
      render(p: Params, ctx: RenderContext) {
        const input = ctx.inputs.source ?? null;
        if (!input) return; // sin entrada queda transparente
        const u = material.uniforms;
        u.uTex.value = input;
        u.uResolution.value.set(ctx.width, ctx.height);
        u.uCell.value = Math.max(1, (p.cell as number) * ctx.unit);
        u.uMode.value = p.mode === 'umbral' ? 1 : p.mode === 'bayer' ? 2 : 0;
        u.uThreshold.value = p.threshold;
        u.uContrast.value = p.contrast;
        u.uMixAmount.value = p.amount;
        rgb(p.ink as string, u.uInk.value);
        rgb(p.ground as string, u.uGround.value);
        u.uGroundAlpha.value = p.transparent ? 0 : 1;
        ctx.renderer.setRenderTarget(ctx.target);
        ctx.renderer.render(scene, camera);
      },
      dispose() {
        material.dispose();
        quad.geometry.dispose();
      },
    };
  },
});
