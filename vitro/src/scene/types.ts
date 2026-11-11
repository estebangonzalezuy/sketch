export type Vec3 = [number, number, number]
export type Ease = [number, number, number, number]

export type ShapeKind = 'sphere' | 'torus' | 'capsule' | 'blob' | 'text' | 'dish' | 'box'
export type LightKind = 'area' | 'spot' | 'hdri'
export type LayerKind = ShapeKind | LightKind | 'backdrop'

export interface Material {
  preset: string
  color: string
  roughness: number
  metalness: number
  transmission: number
  ior: number
  dispersion: number
  iridescence: number
  film: number // espesor de la película, nm
  emission: number
  density: number // absorción dentro del vidrio
  scratches: number
}

interface Base {
  id: string
  name: string
  visible: boolean
}

export interface ShapeLayer extends Base {
  kind: ShapeKind
  position: Vec3
  rotation: Vec3 // grados
  scale: number
  merge: number // 0 = sólido aparte, >0 = se funde con las otras capas líquidas
  material: Material
  // parámetros por tipo (los que no aplican se ignoran)
  radius: number
  tube: number
  length: number
  count: number
  spread: number
  morph: number
  seed: number
  smooth: number
  text: string
  depth: number
  height: number
  wall: number
  hollow: boolean
  round: number
  size: Vec3
}

export interface AreaLight extends Base {
  kind: 'area'
  position: Vec3
  target: Vec3
  width: number
  height: number
  intensity: number
  white: number // 0 = color de la paleta, 1 = blanco
  seen: boolean // visible para la cámara
}

export interface SpotLight extends Base {
  kind: 'spot'
  position: Vec3
  target: Vec3
  radius: number
  angle: number
  softness: number
  intensity: number
  white: number
}

export type HdriPreset = 'estudio' | 'softboxes' | 'horizonte' | 'anillo' | 'uniforme'

export interface HdriLight extends Base {
  kind: 'hdri'
  preset: HdriPreset
  intensity: number
  rotation: number
  tint: number // cuánto toma del color de luz de la paleta
  background: boolean // se ve como fondo
}

export interface Backdrop extends Base {
  kind: 'backdrop'
  floor: boolean
  floorY: number
  roughness: number
  metalness: number
}

export type LightLayer = AreaLight | SpotLight | HdriLight
export type Layer = ShapeLayer | LightLayer | Backdrop

export interface Camera {
  azimuth: number
  polar: number
  distance: number
  target: Vec3
  focal: number // mm, sensor de 24 mm de alto
  dof: boolean
  fstop: number
  focus: number
}

export interface Framing {
  id: string
  name: string
  camera: Camera
}

export type Format = '1080x1350' | '1080x1920' | '1920x1080'

export interface RenderSettings {
  samples: number
  bounces: number
  denoise: number
  exposure: number
  bloom: number
  bloomRadius: number
  grain: number
  vignette: number
}

export interface Key {
  t: number // 0..1 dentro del loop
  v: number
  ease: Ease // curva hacia la siguiente clave
}

export interface Track {
  id: string
  target: string // id de capa o 'camera'
  prop: string // p. ej. 'rotation.1', 'morph', 'position.0', 'azimuth'
  keys: Key[]
}

export interface Scene {
  v: 1
  name: string
  layers: Layer[]
  camera: Camera
  framings: Framing[]
  format: Format
  palette: { pair: number; invert: boolean }
  render: RenderSettings
  anim: { duration: number; fps: number; tracks: Track[] }
}

export const SHAPE_KINDS: ShapeKind[] = ['sphere', 'torus', 'capsule', 'blob', 'text', 'dish', 'box']
export const isShape = (l: Layer): l is ShapeLayer => (SHAPE_KINDS as string[]).includes(l.kind)

export const KIND_LABEL: Record<LayerKind, string> = {
  sphere: 'Esfera',
  torus: 'Toro',
  capsule: 'Cápsula',
  blob: 'Blob',
  text: 'Texto',
  dish: 'Disco',
  box: 'Caja',
  area: 'Luz de área',
  spot: 'Spot',
  hdri: 'HDRI',
  backdrop: 'Fondo',
}

export const FORMATS: Record<Format, { w: number; h: number; label: string }> = {
  '1080x1350': { w: 1080, h: 1350, label: '4:5 · 1080×1350' },
  '1080x1920': { w: 1080, h: 1920, label: '9:16 · 1080×1920' },
  '1920x1080': { w: 1920, h: 1080, label: '16:9 · 1920×1080' },
}
