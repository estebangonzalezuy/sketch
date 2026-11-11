import * as THREE from 'three'
import type { HdriPreset } from '../scene/types'

const W = 512, H = 256
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
// panel rectangular suave en coordenadas (azimut, elevación) en radianes
const panel = (az: number, el: number, a0: number, e0: number, wa: number, we: number, soft = 0.08) => {
  let da = Math.abs(az - a0); if (da > Math.PI) da = 2 * Math.PI - da
  return (1 - sm(wa, wa + soft, da)) * (1 - sm(we, we + soft, Math.abs(el - e0)))
}

/** Entorno HDR procedural. Devuelve [luz con color, luz blanca] para una dirección. */
function sample(preset: HdriPreset, az: number, el: number): [number, number] {
  switch (preset) {
    case 'estudio': {
      const top = sm(0.75, 1.25, el) * 2.2
      const key = panel(az, el, 0.9, 0.35, 0.5, 0.42) * 5
      const rim = panel(az, el, -2.3, 0.2, 0.18, 0.7) * 3.5
      return [0.03 + top * 0.4 + key * 0.5 + rim, top * 0.6 + key * 0.5]
    }
    case 'softboxes': {
      const a = panel(az, el, 0.6, 0.5, 0.42, 0.3) * 6
      const b = panel(az, el, -1.6, 0.15, 0.28, 0.55) * 4
      const c = panel(az, el, 2.7, -0.1, 0.5, 0.16) * 3
      const d = panel(az, el, -0.4, 1.15, 0.9, 0.16) * 2.5
      return [0.015 + b + c * 0.6 + d * 0.5, a + c * 0.4 + d * 0.5]
    }
    case 'horizonte': {
      const band = Math.exp(-((el / 0.16) ** 2)) * 3.2
      const sky = sm(-0.2, 1.4, el) * 0.5
      return [0.02 + band * 0.7 + sky, band * 0.3]
    }
    case 'anillo': {
      const ring = Math.exp(-(((el - 0.75) / 0.07) ** 2)) * 7
      const low = Math.exp(-(((el + 0.5) / 0.1) ** 2)) * 2
      return [0.02 + ring * 0.6 + low, ring * 0.4]
    }
    default:
      return [0.6, 0.4]
  }
}

export function buildEnv(preset: HdriPreset, light: number[], tint: number): THREE.DataTexture {
  const data = new Uint16Array(W * H * 4)
  const hf = THREE.DataUtils.toHalfFloat
  for (let y = 0; y < H; y++) {
    const el = Math.PI / 2 - ((y + 0.5) / H) * Math.PI
    for (let x = 0; x < W; x++) {
      const az = ((x + 0.5) / W) * 2 * Math.PI - Math.PI
      const [c, w] = sample(preset, az, el)
      const i = (y * W + x) * 4
      for (let k = 0; k < 3; k++) data[i + k] = hf(c * (1 + (light[k] - 1) * tint) + w * (1 + (light[k] - 1) * tint * 0.35))
      data[i + 3] = hf(1)
    }
  }
  return finish(new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType))
}

export function finish(tex: THREE.DataTexture): THREE.DataTexture {
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}
