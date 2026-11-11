import { create } from 'zustand'
import { evalKeys, getPath, resolveScene, setPath } from './scene/animate'
import { makeLayer, uid } from './scene/defaults'
import { PAIRS } from './scene/palettes'
import { PRESETS } from './scene/presets'
import { loadSlots, saveSlots, sceneFromHash, type Slot } from './scene/codec'
import { isShape, type Camera, type Ease, type Layer, type LayerKind, type Scene, type Track } from './scene/types'
import { MAX_LIGHT, MAX_OBJ } from './engine/glsl'
import type { Mode } from './engine/Engine'

export type Selection = string | null // id de capa, 'camera', 'scene' o null

interface State {
  scene: Scene
  selected: Selection
  selKey: { track: string; index: number } | null
  time: number
  playing: boolean
  mode: Mode
  past: Scene[]
  future: Scene[]
  rev: number // sube cuando la escena cambia desde fuera del panel (deshacer, cargar, presets)
  slots: Slot[]
  toast: string | null
  samples: number
  busy: { label: string; progress: number } | null
}

const initial = (): Scene => sceneFromHash() ?? PRESETS[0].build()

export const useStore = create<State>(() => ({
  scene: initial(), selected: null, selKey: null, time: 0, playing: false, mode: 'preview',
  past: [], future: [], rev: 0, slots: loadSlots(), toast: null, samples: 0, busy: null,
}))
const { getState: get, setState: set } = useStore

let lastTag = '', lastAt = 0
/** Aplica un cambio a la escena con historial. Ediciones seguidas con el mismo tag se funden. */
export function edit(fn: (s: Scene) => Scene, tag = '') {
  const st = get()
  const next = fn(st.scene)
  if (next === st.scene) return
  const now = performance.now()
  const merge = tag !== '' && tag === lastTag && now - lastAt < 700 && st.past.length > 0
  lastTag = tag; lastAt = now
  set({ scene: next, past: merge ? st.past : [...st.past.slice(-99), st.scene], future: [] })
}
const external = (patch: Partial<State>) => { lastTag = ''; set({ ...patch, rev: get().rev + 1 }) }

export function undo() {
  const st = get(); const prev = st.past[st.past.length - 1]
  if (prev) external({ scene: prev, past: st.past.slice(0, -1), future: [st.scene, ...st.future], selKey: null })
}
export function redo() {
  const st = get(); const next = st.future[0]
  if (next) external({ scene: next, past: [...st.past, st.scene], future: st.future.slice(1), selKey: null })
}
export function loadScene(scene: Scene, keepHistory = true) {
  const st = get()
  external({ scene, past: keepHistory ? [...st.past.slice(-99), st.scene] : [], future: [], selected: null, selKey: null, time: 0, playing: false })
}
export const toast = (msg: string) => { set({ toast: msg }); setTimeout(() => get().toast === msg && set({ toast: null }), 2600) }

// ---------- capas ----------
export function addLayer(kind: LayerKind) {
  const sc = get().scene
  if (kind === 'hdri' && sc.layers.some((l) => l.kind === 'hdri')) return toast('La escena ya tiene un HDRI')
  if (kind === 'backdrop' && sc.layers.some((l) => l.kind === 'backdrop')) return toast('La escena ya tiene un fondo')
  if (kind !== 'hdri' && kind !== 'backdrop') {
    const shapes = sc.layers.filter(isShape).length, lights = sc.layers.filter((l) => l.kind === 'area' || l.kind === 'spot').length
    if ((kind === 'area' || kind === 'spot') && lights >= MAX_LIGHT) return toast(`Máximo ${MAX_LIGHT} luces`)
    if (kind !== 'area' && kind !== 'spot' && shapes >= MAX_OBJ) return toast(`Máximo ${MAX_OBJ} formas`)
  }
  const l = makeLayer(kind)
  edit((s) => ({ ...s, layers: [l, ...s.layers] }))
  external({ selected: l.id })
}
export function removeLayer(id: string) {
  edit((s) => ({ ...s, layers: s.layers.filter((l) => l.id !== id), anim: { ...s.anim, tracks: s.anim.tracks.filter((t) => t.target !== id) } }))
  if (get().selected === id) external({ selected: null, selKey: null })
}
export function duplicateLayer(id: string) {
  const sc = get().scene; const i = sc.layers.findIndex((l) => l.id === id); if (i < 0) return
  const src = sc.layers[i]
  if (src.kind === 'hdri' || src.kind === 'backdrop') return toast('Esta capa es única')
  const copy = { ...structuredClone(src), id: uid(), name: `${src.name} copia` } as Layer
  if ('position' in copy) copy.position = [copy.position[0] + 0.4, copy.position[1], copy.position[2] + 0.4]
  const tracks = sc.anim.tracks.filter((t) => t.target === id).map((t) => ({ ...structuredClone(t), id: uid(), target: copy.id }))
  edit((s) => ({ ...s, layers: [...s.layers.slice(0, i), copy, ...s.layers.slice(i)], anim: { ...s.anim, tracks: [...s.anim.tracks, ...tracks] } }))
  external({ selected: copy.id })
}
export function moveLayer(id: string, to: number) {
  edit((s) => {
    const from = s.layers.findIndex((l) => l.id === id); if (from < 0 || from === to) return s
    const layers = [...s.layers]; const [l] = layers.splice(from, 1); layers.splice(Math.max(0, Math.min(layers.length, to)), 0, l)
    return { ...s, layers }
  })
}
export const patchLayer = (id: string, patch: Partial<Layer>, tag = '') =>
  edit((s) => ({ ...s, layers: s.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)) }), tag)
export const select = (sel: Selection) => { if (sel !== get().selected) external({ selected: sel, selKey: null }) }

// ---------- propiedades y claves ----------
const snap = (t: number, s: Scene) => { const n = Math.max(1, Math.round(s.anim.duration * s.anim.fps)); return Math.round(t * n) / n }

/** Escribe un valor numérico. Si la propiedad tiene pista, crea o actualiza la clave en el playhead. */
export function setProp(target: string, prop: string, v: number) {
  const time = get().time
  edit((s) => {
    const ti = s.anim.tracks.findIndex((t) => t.target === target && t.prop === prop)
    let next = target === 'camera' ? { ...s, camera: setPath(s.camera, prop, v) } : { ...s, layers: s.layers.map((l) => (l.id === target ? setPath(l, prop, v) : l)) }
    if (ti >= 0) {
      const tr = s.anim.tracks[ti]; const t = snap(time, s)
      const ki = tr.keys.findIndex((k) => Math.abs(k.t - t) < 1e-4)
      const keys = ki >= 0 ? tr.keys.map((k, i) => (i === ki ? { ...k, v } : k)) : [...tr.keys, { t, v, ease: [0.42, 0, 0.58, 1] as Ease }].sort((a, b) => a.t - b.t)
      next = { ...next, anim: { ...s.anim, tracks: s.anim.tracks.map((x, i) => (i === ti ? { ...tr, keys } : x)) } }
    }
    return next
  }, `${target}.${prop}`)
}
export function setLayerField(id: string, path: string, v: unknown) {
  edit((s) => ({ ...s, layers: s.layers.map((l) => (l.id === id ? setPath(l, path, v as number) : l)) }), `${id}.${path}`)
}

export function addTrack(target: string, prop: string) {
  const st = get(); const s = st.scene
  if (s.anim.tracks.some((t) => t.target === target && t.prop === prop)) return
  const rs = resolveScene(s, st.time)
  const src = target === 'camera' ? rs.camera : rs.layers.find((l) => l.id === target)
  if (!src) return
  const v = getPath(src, prop)
  // dos claves por defecto: un ciclo completo para giros y morph, ida y vuelta para el resto
  const spin = prop.startsWith('rotation') || prop === 'azimuth'
  const keys = prop === 'morph' ? [{ t: 0, v: 0, ease: [0, 0, 1, 1] as Ease }, { t: 1, v: 1, ease: [0, 0, 1, 1] as Ease }]
    : spin ? [{ t: 0, v, ease: [0, 0, 1, 1] as Ease }, { t: 1, v: v + 360, ease: [0, 0, 1, 1] as Ease }]
    : [{ t: 0, v, ease: [0.42, 0, 0.58, 1] as Ease }, { t: 0.5, v: v + (Math.abs(v) > 2 ? Math.abs(v) * 0.2 : 0.5), ease: [0.42, 0, 0.58, 1] as Ease }]
  const tr: Track = { id: uid(), target, prop, keys }
  edit((x) => ({ ...x, anim: { ...x.anim, tracks: [...x.anim.tracks, tr] } }))
}
export const removeTrack = (id: string) => { edit((s) => ({ ...s, anim: { ...s.anim, tracks: s.anim.tracks.filter((t) => t.id !== id) } })); set({ selKey: null }) }
const mapTrack = (id: string, fn: (t: Track) => Track, tag = '') =>
  edit((s) => ({ ...s, anim: { ...s.anim, tracks: s.anim.tracks.map((t) => (t.id === id ? fn(t) : t)) } }), tag)

export function addKeyAt(trackId: string, t: number) {
  const s = get().scene; const tr = s.anim.tracks.find((x) => x.id === trackId); if (!tr) return
  t = snap(t, s)
  if (tr.keys.some((k) => Math.abs(k.t - t) < 1e-4)) return
  const v = evalKeys(tr.keys, t) ?? 0
  mapTrack(trackId, (x) => ({ ...x, keys: [...x.keys, { t, v, ease: [0.42, 0, 0.58, 1] as Ease }].sort((a, b) => a.t - b.t) }))
  const idx = get().scene.anim.tracks.find((x) => x.id === trackId)!.keys.findIndex((k) => Math.abs(k.t - t) < 1e-4)
  set({ selKey: { track: trackId, index: idx } })
}
/** Tecla K: clave en el playhead para todas las pistas de la selección. */
export function keySelected() {
  const st = get(); if (!st.selected) return
  const tracks = st.scene.anim.tracks.filter((t) => t.target === st.selected)
  if (!tracks.length) return toast('La selección no tiene pistas. Agregá una desde la timeline.')
  tracks.forEach((t) => addKeyAt(t.id, st.time))
}
export function moveKey(trackId: string, index: number, t: number) {
  const s = get().scene; t = Math.min(1, Math.max(0, snap(t, s)))
  const tr = s.anim.tracks.find((x) => x.id === trackId); if (!tr) return
  if (tr.keys.some((k, i) => i !== index && Math.abs(k.t - t) < 1e-4)) return
  const key = { ...tr.keys[index], t }
  const keys = tr.keys.map((k, i) => (i === index ? key : k)).sort((a, b) => a.t - b.t)
  mapTrack(trackId, (x) => ({ ...x, keys }), `key.${trackId}`)
  set({ selKey: { track: trackId, index: keys.indexOf(key) } })
}
export const patchKey = (trackId: string, index: number, patch: { v?: number; ease?: Ease }) =>
  mapTrack(trackId, (x) => ({ ...x, keys: x.keys.map((k, i) => (i === index ? { ...k, ...patch } : k)) }), `keyv.${trackId}.${index}`)
export function removeKey(trackId: string, index: number) {
  const tr = get().scene.anim.tracks.find((x) => x.id === trackId); if (!tr) return
  if (tr.keys.length <= 1) return removeTrack(trackId)
  mapTrack(trackId, (x) => ({ ...x, keys: x.keys.filter((_, i) => i !== index) }))
  external({ selKey: null })
}

// ---------- cámara, paleta, formato ----------
export const patchCamera = (patch: Partial<Camera>, tag = 'camera') => edit((s) => ({ ...s, camera: { ...s.camera, ...patch } }), tag)
export function saveFraming() {
  const s = get().scene
  const f = { id: uid(), name: `Encuadre ${s.framings.length + 1}`, camera: resolveScene(s, get().time).camera }
  edit((x) => ({ ...x, framings: [...x.framings, f] })); toast(`${f.name} guardado`)
}
export function applyFraming(id: string) {
  const f = get().scene.framings.find((x) => x.id === id); if (!f) return
  edit((s) => ({ ...s, camera: f.camera })); external({})
}
export const removeFraming = (id: string) => edit((s) => ({ ...s, framings: s.framings.filter((f) => f.id !== id) }))
export function randomPalette() {
  const cur = get().scene.palette
  let pair = cur.pair
  while (pair === cur.pair) pair = Math.floor(Math.random() * PAIRS.length)
  edit((s) => ({ ...s, palette: { pair, invert: Math.random() < 0.2 } })); external({})
}

// ---------- slots ----------
export function saveSlot(name?: string) {
  const s = get().scene
  const slots = [{ name: name || s.name, at: Date.now(), scene: s }, ...get().slots.filter((x) => x.name !== (name || s.name))].slice(0, 24)
  set({ slots }); saveSlots(slots); toast(`Guardado en “${slots[0].name}”`)
}
export function deleteSlot(name: string) { const slots = get().slots.filter((x) => x.name !== name); set({ slots }); saveSlots(slots) }

export const setTime = (t: number) => set({ time: ((t % 1) + 1) % 1 })
export const setMode = (mode: Mode) => set({ mode })
export const togglePlay = () => set({ playing: !get().playing })
