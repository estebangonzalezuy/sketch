import * as THREE from 'three';
import type { Layer } from '../core/project';
import { FullscreenPass } from './renderer';

const BLENDS: Record<Layer['blend'], number> = { normal: 0, add: 1, multiply: 2, screen: 3 };

/** Mezcla en premultiplied alpha, sobre un acumulado que va y vuelve entre dos targets. */
export class Compositor {
  private pass = new FullscreenPass(
    /* glsl */ `
    uniform sampler2D uSrc;
    uniform sampler2D uDst;
    uniform float uOpacity;
    uniform int uBlend;
    varying vec2 vUv;
    void main() {
      vec4 s = texture2D(uSrc, vUv) * uOpacity;
      vec4 d = texture2D(uDst, vUv);
      vec3 rgb;
      if (uBlend == 1) rgb = s.rgb + d.rgb;
      else if (uBlend == 2) rgb = s.rgb * d.rgb + s.rgb * (1.0 - d.a) + d.rgb * (1.0 - s.a);
      else if (uBlend == 3) rgb = s.rgb + d.rgb - s.rgb * d.rgb;
      else rgb = s.rgb + d.rgb * (1.0 - s.a);
      gl_FragColor = vec4(rgb, s.a + d.a * (1.0 - s.a));
    }`,
    { uSrc: { value: null }, uDst: { value: null }, uOpacity: { value: 1 }, uBlend: { value: 0 } },
  );

  private framing = new FullscreenPass(
    /* glsl */ `
    uniform sampler2D uTex;
    uniform float uZoom;
    uniform vec2 uCenter;
    varying vec2 vUv;
    void main() {
      vec2 uv = (vUv - 0.5) / uZoom + uCenter;
      bool inside = uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0;
      gl_FragColor = inside ? texture2D(uTex, uv) : vec4(0.0);
    }`,
    { uTex: { value: null }, uZoom: { value: 1 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) } },
  );

  /** Compone src sobre dst y escribe en out. */
  draw(
    renderer: THREE.WebGLRenderer,
    src: THREE.WebGLRenderTarget,
    dst: THREE.WebGLRenderTarget,
    out: THREE.WebGLRenderTarget,
    opacity: number,
    blend: Layer['blend'],
  ) {
    const u = this.pass.material.uniforms;
    u.uSrc.value = src.texture;
    u.uDst.value = dst.texture;
    u.uOpacity.value = opacity;
    u.uBlend.value = BLENDS[blend];
    this.pass.draw(renderer, out);
  }

  /** Encuadra una capa: `center` queda en el medio del cuadro. Fuera de la capa es transparente. */
  frame(renderer: THREE.WebGLRenderer, src: THREE.WebGLRenderTarget, out: THREE.WebGLRenderTarget, zoom: number, center: [number, number]) {
    const u = this.framing.material.uniforms;
    u.uTex.value = src.texture;
    u.uZoom.value = zoom;
    u.uCenter.value.set(center[0], center[1]);
    this.framing.draw(renderer, out);
  }

  dispose() {
    this.pass.dispose();
    this.framing.dispose();
  }
}
