import * as THREE from 'three';

/**
 * Flujo de color único del motor:
 *  - Todo render target de capa es RGBA8 y guarda valores sRGB codificados, en premultiplied alpha.
 *  - Las tools entregan esos valores. Una tool que renderiza en lineal (3D) codifica ella misma antes de
 *    escribir al target: three no aplica tone mapping ni salida sRGB igual en un target que en pantalla.
 *  - El compositor mezcla esos valores tal cual, como el modo por defecto de After Effects.
 *  - El canvas recibe el resultado sin conversión.
 */
export function createRenderer(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    preserveDrawingBuffer: true, // necesario para capturar el canvas
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1); // la resolución la decide renderFrame, no el DPR
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; // solo cuesta si una luz proyecta sombra
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/** Triángulos a pantalla completa con un shader propio. */
export class FullscreenPass {
  readonly material: THREE.ShaderMaterial;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mesh: THREE.Mesh;

  constructor(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader,
      uniforms,
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(this.mesh);
  }

  draw(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

/** Copia una textura premultiplied a un target, o al canvas con target null. Con matte, compone sobre ese color. */
export class Blitter {
  private pass = new FullscreenPass(
    /* glsl */ `
    uniform sampler2D uTex;
    uniform vec4 uMatte;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(uTex, vUv);
      gl_FragColor = c + uMatte * (1.0 - c.a);
    }`,
    { uTex: { value: null }, uMatte: { value: new THREE.Vector4(0, 0, 0, 0) } },
  );

  draw(renderer: THREE.WebGLRenderer, texture: THREE.Texture, target: THREE.WebGLRenderTarget | null, matte: string | null = null) {
    const u = this.pass.material.uniforms;
    u.uTex.value = texture;
    const n = matte ? parseInt(matte.slice(1), 16) : 0;
    u.uMatte.value.set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, matte ? 1 : 0);
    this.pass.draw(renderer, target);
  }

  dispose() {
    this.pass.dispose();
  }
}
