import type { Ease, Key, Layer, LayerKind, Scene, Track } from './types'

export const LINEAR: Ease = [0, 0, 1, 1]
export const EASES: Record<string, Ease> = {
  Lineal: [0, 0, 1, 1],
  Suave: [0.42, 0, 0.58, 1],
  Entrada: [0.5, 0, 1, 1],
  Salida: [0, 0, 0.5, 1],
  Expo: [0.87, 0, 0.13, 1],
  Rebote: [0.34, 1.56, 0.64, 1],
}

export function bezier(e: Ease, x: number): number {
  const [x1, y1, x2, y2] = e
  if (x1 === y1 && x2 === y2) return x
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  let t = x
  for (let i = 0; i < 8; i++) {
    const f = ((ax * t + bx) * t + cx) * t - x
    const d = (3 * ax * t + 2 * bx) * t + cx
    if (Math.abs(f) < 1e-5 || Math.abs(d) < 1e-6) break
    t -= f / d
  }
  t = Math.min(1, Math.max(0, t))
  return ((ay * t + by) * t + cy) * t
}

/** Valor de una pista en t (0..1). La última clave vuelve a la primera: el loop siempre cierra. */
export function evalKeys(keys: Key[], t: number): number | undefined {
  const n = keys.length
  if (n === 0) return undefined
  if (n === 1) return keys[0].v
  const first = keys[0], last = keys[n - 1]
  if (t < first.t || t >= last.t) {
    const span = 1 - last.t + first.t
    if (span < 1e-6) return t >= last.t ? last.v : first.v
    const u = (t >= last.t ? t - last.t : t + 1 - last.t) / span
    return last.v + (first.v - last.v) * bezier(last.ease, u)
  }
  let i = 0
  while (i < n - 2 && keys[i + 1].t <= t) i++
  const a = keys[i], b = keys[i + 1]
  const u = (t - a.t) / Math.max(b.t - a.t, 1e-6)
  return a.v + (b.v - a.v) * bezier(a.ease, u)
}

export function getPath(obj: any, path: string): number {
  const parts = path.split('.')
  let o = obj
  for (const p of parts) o = o?.[p]
  return o as number
}
export function setPath<T>(obj: T, path: string, v: number): T {
  const parts = path.split('.')
  const out: any = Array.isArray(obj) ? [...(obj as any)] : { ...(obj as any) }
  if (parts.length === 1) out[parts[0]] = v
  else out[parts[0]] = setPath(out[parts[0]], parts.slice(1).join('.'), v)
  return out
}

/** Escena con las pistas aplicadas en t. No muta la original. */
export function resolveScene(scene: Scene, t: number): Scene {
  if (!scene.anim.tracks.length) return scene
  let camera = scene.camera
  const patched = new Map<string, Layer>()
  for (const tr of scene.anim.tracks) {
    const v = evalKeys(tr.keys, t)
    if (v === undefined) continue
    if (tr.target === 'camera') camera = setPath(camera, tr.prop, v)
    else {
      const l = patched.get(tr.target) ?? scene.layers.find((x) => x.id === tr.target)
      if (l) patched.set(tr.target, setPath(l, tr.prop, v))
    }
  }
  return { ...scene, camera, layers: scene.layers.map((l) => patched.get(l.id) ?? l) }
}

export interface AnimProp { prop: string; label: string }
const XYZ = ['X', 'Y', 'Z']
const vec = (p: string, label: string): AnimProp[] => XYZ.map((a, i) => ({ prop: `${p}.${i}`, label: `${label} ${a}` }))

export function animProps(kind: LayerKind | 'camera'): AnimProp[] {
  if (kind === 'camera')
    return [
      { prop: 'azimuth', label: 'Órbita' }, { prop: 'polar', label: 'Elevación' }, { prop: 'distance', label: 'Distancia' },
      { prop: 'focal', label: 'Focal' }, { prop: 'focus', label: 'Foco' }, ...vec('target', 'Objetivo'),
    ]
  if (kind === 'area' || kind === 'spot') return [...vec('position', 'Posición'), { prop: 'intensity', label: 'Intensidad' }]
  if (kind === 'hdri') return [{ prop: 'rotation', label: 'Rotación' }, { prop: 'intensity', label: 'Intensidad' }]
  if (kind === 'backdrop') return []
  const base = [...vec('rotation', 'Rotación'), ...vec('position', 'Posición'), { prop: 'scale', label: 'Escala' }]
  if (kind === 'blob') base.unshift({ prop: 'morph', label: 'Morph' })
  return base
}

export function propLabel(kind: LayerKind | 'camera', prop: string) {
  return animProps(kind).find((p) => p.prop === prop)?.label ?? prop
}

export function sortKeys(tr: Track): Track {
  return { ...tr, keys: [...tr.keys].sort((a, b) => a.t - b.t) }
}
