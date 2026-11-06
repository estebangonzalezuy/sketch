import * as THREE from 'three';

/** Pool de render targets por tamaño: cambiar de escala no reserva memoria de más. */
export class TargetPool {
  private free = new Map<string, THREE.WebGLRenderTarget[]>();

  acquire(width: number, height: number) {
    const target = this.free.get(`${width}x${height}`)?.pop();
    if (target) return target;
    return new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      generateMipmaps: false,
    });
  }

  release(target: THREE.WebGLRenderTarget) {
    const key = `${target.width}x${target.height}`;
    const list = this.free.get(key) ?? [];
    list.push(target);
    this.free.set(key, list);
  }

  dispose() {
    this.free.forEach((list) => list.forEach((t) => t.dispose()));
    this.free.clear();
  }
}
