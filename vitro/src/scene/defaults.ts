import { mat } from './materials'
import { KIND_LABEL, type AreaLight, type Backdrop, type Camera, type HdriLight, type Layer, type LayerKind, type Scene, type ShapeKind, type ShapeLayer, type SpotLight } from './types'

export const uid = () => Math.random().toString(36).slice(2, 8)

export function shape(kind: ShapeKind, over: Partial<ShapeLayer> = {}): ShapeLayer {
  return {
    id: uid(), name: KIND_LABEL[kind], visible: true, kind,
    position: [0, 0, 0], rotation: [0, 0, 0], scale: 1, merge: 0, material: mat('Vidrio'),
    radius: kind === 'capsule' ? 0.45 : 1, tube: 0.35, length: 1.6, count: 5, spread: 0.9, morph: 0, seed: 1, smooth: 0.6,
    text: 'vitro', depth: 0.5, height: kind === 'dish' ? 0.34 : 1.6, wall: 0.08, hollow: true, round: 0.04, size: [1.6, 1.6, 1.6],
    ...over,
  }
}
export const area = (over: Partial<AreaLight> = {}): AreaLight => ({
  id: uid(), name: 'Luz de área', visible: true, kind: 'area', position: [-3, 4, 3], target: [0, 0, 0], width: 3, height: 3, intensity: 6, white: 0, seen: false, ...over,
})
export const spot = (over: Partial<SpotLight> = {}): SpotLight => ({
  id: uid(), name: 'Spot', visible: true, kind: 'spot', position: [2.5, 5, 2], target: [0, 0, 0], radius: 0.3, angle: 40, softness: 0.5, intensity: 8, white: 0, ...over,
})
export const hdri = (over: Partial<HdriLight> = {}): HdriLight => ({
  id: uid(), name: 'HDRI', visible: true, kind: 'hdri', preset: 'estudio', intensity: 1, rotation: 0, tint: 0.6, background: false, ...over,
})
export const backdrop = (over: Partial<Backdrop> = {}): Backdrop => ({
  id: uid(), name: 'Fondo', visible: true, kind: 'backdrop', floor: false, floorY: -1.2, roughness: 0.9, metalness: 0, ...over,
})

export function makeLayer(kind: LayerKind): Layer {
  if (kind === 'area') return area()
  if (kind === 'spot') return spot()
  if (kind === 'hdri') return hdri()
  if (kind === 'backdrop') return backdrop()
  return shape(kind)
}

export const camera = (over: Partial<Camera> = {}): Camera => ({
  azimuth: 25, polar: 72, distance: 9, target: [0, 0, 0], focal: 50, dof: false, fstop: 2.8, focus: 9, ...over,
})

export function scene(over: Partial<Scene> & { layers: Layer[] }): Scene {
  return {
    v: 1, name: 'Sin título', camera: camera(), framings: [], format: '1080x1350', palette: { pair: 0, invert: false },
    render: { samples: 256, bounces: 12, denoise: 0.5, exposure: 1, bloom: 0.35, bloomRadius: 1.2, grain: 0.12, vignette: 0.25 },
    anim: { duration: 4, fps: 30, tracks: [] },
    ...over,
  }
}
