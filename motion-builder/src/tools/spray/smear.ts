import * as THREE from 'three';
import { SMEAR_FRAG } from './shaders';
import { Quad, shader } from './gl';

// Smear como pista: los trazos viven en la capa (frame local, x, y) y el campo de desplazamiento se
// reproduce desde el inicio del clip. Avanzar de a un frame cuesta un pase; volver atrás o saltar
// recalcula desde 0, así el resultado no depende del orden en que se piden los frames.

export interface StrokePoint {
  f: number;
  x: number;
  y: number;
}

/** "f,x,y;f,x,y|f,x,y…": un trazo por "|", un punto por ";". x e y van de 0 a 1, con y hacia arriba. */
export function parseStrokes(text: string): StrokePoint[][] {
  if (!text) return [];
  return text
    .split('|')
    .map((s) =>
      s
        .split(';')
        .map((p) => p.split(',').map(Number))
        .filter((p) => p.length === 3 && p.every(Number.isFinite))
        .map(([f, x, y]) => ({ f: Math.max(0, Math.round(f)), x, y })),
    )
    .filter((s) => s.length > 0);
}

export function formatStrokes(strokes: StrokePoint[][]): string {
  return strokes.map((s) => s.map((p) => `${p.f},${p.x.toFixed(4)},${p.y.toFixed(4)}`).join(';')).join('|');
}

interface Stamp {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

/** Estampas por frame: cada tramo se subdivide para que ninguna mueva más de 1/4 del radio. */
export function stampsByFrame(strokes: StrokePoint[][], radius: number, aspect: number): Map<number, Stamp[]> {
  const out = new Map<number, Stamp[]>();
  for (const s of strokes) {
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1];
      const b = s[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const steps = Math.min(24, Math.max(1, Math.ceil(Math.hypot(dx * aspect, dy) / (radius * 0.25))));
      const list = out.get(b.f) ?? [];
      for (let k = 1; k <= steps; k++) list.push({ x: a.x + (dx * k) / steps, y: a.y + (dy * k) / steps, dx: dx / steps, dy: dy / steps });
      out.set(b.f, list);
    }
  }
  return out;
}

const LONG_SIDE = 256;

export class SmearField {
  private targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;
  private material = shader(SMEAR_FRAG, {
    uField: { value: null },
    uPos: { value: new THREE.Vector2() },
    uDelta: { value: new THREE.Vector2() },
    uRadius: { value: 0.1 },
    uAspect: { value: 1 },
    uDecay: { value: 1 },
    uStamp: { value: 0 },
  });
  private frame = -1;
  private key = '';

  get texture(): THREE.Texture | null {
    return this.targets ? this.targets[0].texture : null;
  }

  /** Deja el campo en `toFrame`. Devuelve false si no hay trazos (no hace falta campo). */
  advance(renderer: THREE.WebGLRenderer, quad: Quad, strokesText: string, toFrame: number, fps: number, brush: number, spring: number, width: number, height: number): boolean {
    if (!strokesText) return false;
    const aspect = width / height;
    const s = LONG_SIDE / Math.max(width, height);
    const fw = Math.max(8, Math.round(width * s));
    const fh = Math.max(8, Math.round(height * s));
    const key = `${strokesText}|${brush}|${spring}|${fps}|${fw}x${fh}`;
    if (!this.targets || this.targets[0].width !== fw || this.targets[0].height !== fh) {
      this.targets?.forEach((t) => t.dispose());
      const make = () => new THREE.WebGLRenderTarget(fw, fh, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      this.targets = [make(), make()];
      this.frame = -1;
    }
    if (key !== this.key || toFrame < this.frame) {
      for (const t of this.targets) {
        renderer.setRenderTarget(t);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
      }
      this.frame = -1;
      this.key = key;
    }
    const stamps = stampsByFrame(parseStrokes(strokesText), brush, aspect);
    const decay = Math.exp((-spring * spring * 9) / fps);
    const u = this.material.uniforms;
    u.uRadius.value = brush;
    u.uAspect.value = aspect;
    for (let f = this.frame + 1; f <= toFrame; f++) {
      const list = stamps.get(f) ?? [];
      const d = f === 0 ? 1 : decay;
      if (!list.length && d === 1) continue;
      const passes = Math.max(1, list.length);
      for (let i = 0; i < passes; i++) {
        const st = list[i];
        const src: THREE.WebGLRenderTarget = this.targets[0];
        const dst: THREE.WebGLRenderTarget = this.targets[1];
        u.uField.value = src.texture;
        u.uDecay.value = i === 0 ? d : 1;
        u.uStamp.value = st ? 1 : 0;
        u.uPos.value.set(st?.x ?? 0, st?.y ?? 0);
        u.uDelta.value.set(st?.dx ?? 0, st?.dy ?? 0);
        quad.draw(renderer, this.material, dst);
        this.targets = [dst, src];
      }
    }
    this.frame = Math.max(this.frame, toFrame);
    return true;
  }

  dispose(): void {
    this.targets?.forEach((t) => t.dispose());
    this.material.dispose();
  }
}
