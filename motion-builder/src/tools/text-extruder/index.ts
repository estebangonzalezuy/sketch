import * as THREE from 'three';
import { defineTool, type Params, type RenderContext } from '../../core/tool';
import animations from './animations';
import presets from './presets.json';
import { ExtruderScene, FAMILIES, LOOKS } from './scene';

/** Tone mapping y salida sRGB, los mismos de three en pantalla: en un render target no los aplica. */
const OUTPUT_SHADER = /* glsl */ `
uniform sampler2D uTex;
uniform float uExposure;
uniform vec3 uBackground;
uniform float uBackgroundAlpha;
varying vec2 vUv;

vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}

vec3 aces(vec3 color) {
  const mat3 input_ = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 output_ = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= uExposure / 0.6;
  color = RRTAndODTFit(input_ * color);
  return clamp(output_ * color, 0.0, 1.0);
}

vec3 encode(vec3 c) {
  return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
}

void main() {
  vec4 src = texture2D(uTex, vUv);
  vec3 straight = src.a > 0.0 ? src.rgb / src.a : vec3(0.0);
  vec3 rgb = encode(aces(max(straight, 0.0))) * src.a; // premultiplied, en valores codificados
  float bg = uBackgroundAlpha * (1.0 - src.a);
  gl_FragColor = vec4(rgb + uBackground * bg, src.a + bg);
}`;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export default defineTool({
  id: 'text-extruder',
  name: 'Text Extruder',
  version: 1,
  kind: 'generator',
  inputs: [],
  presets,
  animations,
  params: {
    // Tipo: todo reconstruye geometría
    text: { kind: 'text', default: 'Apparat', multiline: true, animate: 'rebuild', group: 'Tipo' },
    family: { kind: 'select', default: 'KMR Apparat', options: Object.keys(FAMILIES), animate: 'rebuild', group: 'Tipo' },
    weight: { kind: 'select', default: 'Book', options: [...new Set(Object.values(FAMILIES).flatMap((f) => f.weights))], animate: 'rebuild', group: 'Tipo' },
    size: { kind: 'number', default: 1, min: 0.2, max: 4, step: 0.01, animate: 'rebuild', group: 'Tipo' },
    tracking: { kind: 'number', default: 0, min: -0.3, max: 1, step: 0.01, animate: 'rebuild', group: 'Tipo' },
    lineHeight: { kind: 'number', default: 1.15, min: 0.7, max: 2.5, step: 0.01, animate: 'rebuild', group: 'Tipo' },
    align: { kind: 'select', default: 'center', options: ['left', 'center', 'right'], animate: 'rebuild', group: 'Tipo' },
    curveSegments: { kind: 'number', default: 10, min: 1, max: 32, step: 1, animate: 'rebuild', group: 'Tipo' },

    // Extrusión
    depth: { kind: 'number', default: 0.35, min: 0.005, max: 3, step: 0.005, animate: 'rebuild', group: 'Extrusión' },
    bevel: { kind: 'boolean', default: true, animate: 'rebuild', group: 'Extrusión' },
    bevelThickness: { kind: 'number', default: 0.03, min: 0, max: 0.2, step: 0.001, animate: 'rebuild', group: 'Extrusión' },
    bevelSize: { kind: 'number', default: 0.02, min: 0, max: 0.08, step: 0.001, animate: 'rebuild', group: 'Extrusión' },
    bevelSegments: { kind: 'number', default: 4, min: 1, max: 12, step: 1, animate: 'rebuild', group: 'Extrusión' },
    arc: { kind: 'number', default: 0, min: -360, max: 360, step: 1, animate: 'rebuild', group: 'Extrusión' },
    stagger: { kind: 'number', default: 0, min: 0, max: 2, step: 0.01, animate: 'rebuild', group: 'Extrusión' },

    // Material
    look: { kind: 'select', default: 'clay', options: Object.keys(LOOKS), animate: 'frame', group: 'Material' },
    face: { kind: 'color', default: '#ECE8E1', animate: 'frame', group: 'Material' },
    side: { kind: 'color', default: '#D9D3C9', animate: 'frame', group: 'Material' },
    gradient: { kind: 'boolean', default: false, animate: 'frame', group: 'Material' },
    gradientTo: { kind: 'color', default: '#3A5BFF', animate: 'frame', group: 'Material' },
    roughness: { kind: 'number', default: 0.9, min: 0, max: 1, step: 0.01, animate: 'frame', group: 'Material' },
    metalness: { kind: 'number', default: 0, min: 0, max: 1, step: 0.01, animate: 'frame', group: 'Material' },
    flatShading: { kind: 'boolean', default: false, animate: 'frame', group: 'Material' },
    wireframe: { kind: 'boolean', default: false, animate: 'frame', group: 'Material' },

    // Pose
    rotX: { kind: 'number', default: 0, min: -180, max: 180, step: 0.1, animate: 'frame', group: 'Pose' },
    rotY: { kind: 'number', default: 0, min: -180, max: 180, step: 0.1, animate: 'frame', group: 'Pose' },
    rotZ: { kind: 'number', default: 0, min: -180, max: 180, step: 0.1, animate: 'frame', group: 'Pose' },
    anim: { kind: 'select', default: 'none', options: ['none', 'turntable', 'wave', 'spin', 'swing'], animate: 'frame', group: 'Pose' },
    speed: { kind: 'number', default: 0.1, min: 0, max: 2, step: 0.001, integrated: true, label: 'ciclos por segundo', animate: 'frame', group: 'Pose' },
    amount: { kind: 'number', default: 0.25, min: 0, max: 1, step: 0.01, animate: 'frame', group: 'Pose' },

    // Cámara: con autoFrame, camX/Y/Z es la dirección desde el texto
    autoFrame: { kind: 'boolean', default: true, animate: 'frame', group: 'Cámara' },
    distance: { kind: 'number', default: 1, min: 0.2, max: 4, step: 0.01, animate: 'frame', group: 'Cámara' },
    camX: { kind: 'number', default: 0.18, min: -20, max: 20, step: 0.01, animate: 'frame', group: 'Cámara' },
    camY: { kind: 'number', default: 0.16, min: -20, max: 20, step: 0.01, animate: 'frame', group: 'Cámara' },
    camZ: { kind: 'number', default: 1, min: -20, max: 20, step: 0.01, animate: 'frame', group: 'Cámara' },
    targetX: { kind: 'number', default: 0, min: -10, max: 10, step: 0.01, animate: 'frame', group: 'Cámara' },
    targetY: { kind: 'number', default: 0, min: -10, max: 10, step: 0.01, animate: 'frame', group: 'Cámara' },
    targetZ: { kind: 'number', default: 0, min: -10, max: 10, step: 0.01, animate: 'frame', group: 'Cámara' },
    fov: { kind: 'number', default: 35, min: 5, max: 120, step: 0.1, animate: 'frame', group: 'Cámara' },

    // Vista
    floor: { kind: 'boolean', default: true, label: 'piso y sombra', animate: 'frame', group: 'Vista' },
    background: { kind: 'boolean', default: false, label: 'fondo opaco', animate: 'frame', group: 'Vista' },
    backgroundColor: { kind: 'color', default: '#111111', animate: 'frame', group: 'Vista' },
    environment: { kind: 'number', default: 0.8, min: 0, max: 2, step: 0.01, animate: 'frame', group: 'Vista' },
    exposure: { kind: 'number', default: 1, min: 0.2, max: 2.5, step: 0.01, animate: 'frame', group: 'Vista' },
  },
  create() {
    const world = new ExtruderScene();
    // Lineal, con el MSAA que el original pedía al canvas.
    const linear = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const output = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: OUTPUT_SHADER,
      uniforms: { uTex: { value: linear.texture }, uExposure: { value: 1 }, uBackground: { value: new THREE.Color() }, uBackgroundAlpha: { value: 0 } },
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), output);
    const quadScene = new THREE.Scene();
    quadScene.add(quad);
    const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const srgb = (hex: string, out: THREE.Color) => {
      const n = parseInt(hex.slice(1), 16);
      return out.setRGB(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, THREE.LinearSRGBColorSpace); // sin conversión
    };

    return {
      async prepare(p: Params, ctx: RenderContext) {
        world.prepareEnvironment(ctx.renderer);
        const specs = ['text', 'family', 'weight', 'size', 'tracking', 'lineHeight', 'align', 'curveSegments', 'depth', 'bevel', 'bevelThickness', 'bevelSize', 'bevelSegments', 'arc', 'stagger'];
        const key = JSON.stringify(specs.map((id) => p[id]));
        if (key === world.buildKey) return;
        await world.build(p);
        world.buildKey = key;
      },
      render(p: Params, ctx: RenderContext) {
        const { renderer } = ctx;
        if (linear.width !== ctx.width || linear.height !== ctx.height) linear.setSize(ctx.width, ctx.height);
        world.applyMaterials(p);
        world.applyMotion(p, ctx.integral('speed'), ctx.loop !== null);
        world.applyCamera(p, ctx.aspect);

        renderer.setRenderTarget(linear);
        renderer.setClearColor(0x000000, 0);
        renderer.render(world.scene, world.camera);

        const u = output.uniforms;
        u.uExposure.value = p.exposure;
        srgb(p.backgroundColor as string, u.uBackground.value);
        u.uBackgroundAlpha.value = p.background ? 1 : 0;
        renderer.setRenderTarget(ctx.target);
        renderer.render(quadScene, quadCamera);
      },
      dispose() {
        world.dispose();
        linear.dispose();
        output.dispose();
        quad.geometry.dispose();
      },
    };
  },
});
