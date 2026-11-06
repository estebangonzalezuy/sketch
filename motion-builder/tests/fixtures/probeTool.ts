import { defineTool, type Params, type RenderContext } from '../../src/core/tool';
import * as THREE from 'three';

/** Tool mínima para probar que el editor no conoce ninguna tool en particular. */
export default defineTool({
  id: 'probe',
  name: 'Sonda',
  version: 1,
  kind: 'generator',
  inputs: [],
  params: {
    fill: { kind: 'color', default: '#00FF00', animate: 'frame', group: 'Sonda' },
    size: { kind: 'number', default: 0.5, min: 0, max: 1, step: 0.01, animate: 'frame', group: 'Sonda' },
    on: { kind: 'boolean', default: true, animate: 'frame', group: 'Sonda' },
    where: { kind: 'vec2', default: [0.5, 0.5], min: 0, max: 1, animate: 'frame', group: 'Sonda' },
    shape: { kind: 'select', default: 'cuadrado', options: ['cuadrado', 'barra'], animate: 'none', group: 'Sonda' },
    note: { kind: 'text', default: 'hola', animate: 'none', group: 'Sonda' },
  },
  create() {
    const data = new Uint8Array([0, 255, 0, 255]);
    const texture = new THREE.DataTexture(data, 1, 1);
    return {
      render(p: Params, ctx: RenderContext) {
        const n = parseInt((p.fill as string).slice(1), 16);
        data.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]);
        texture.needsUpdate = true;
        ctx.blit(texture);
      },
      dispose() {
        texture.dispose();
      },
    };
  },
});
