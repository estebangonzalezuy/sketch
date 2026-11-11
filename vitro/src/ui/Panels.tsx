import { Fragment, useEffect, useMemo, useRef } from 'react'
import { useDialKitController } from 'dialkit'
import { getPath, propLabel, resolveScene } from '../scene/animate'
import { MATERIALS, MATERIAL_NAMES } from '../scene/materials'
import { PAIRS } from '../scene/palettes'
import { FORMATS, isShape, KIND_LABEL, type Ease, type Layer, type Scene } from '../scene/types'
import { edit, patchKey, patchLayer, randomPalette, removeKey, saveFraming, setLayerField, setProp, toast, useStore } from '../store'
import { rt } from '../runtime'

// Un campo une una clave del panel DialKit con una ruta de la escena.
interface F { k: string; p: string; c: (v: any) => any; num?: boolean }
interface G { folder?: string; collapsed?: boolean; fields: F[] }
const num = (k: string, p: string, min: number, max: number, step?: number): F => ({ k, p, num: true, c: (v) => (step ? [v, min, max, step] : [v, min, max]) })
const bool = (k: string, p: string): F => ({ k, p, c: (v) => !!v })
const text = (k: string, p: string): F => ({ k, p, c: (v) => ({ type: 'text', default: String(v) }) })
const color = (k: string, p: string): F => ({ k, p, c: (v) => ({ type: 'color', default: v }) })
const sel = (k: string, p: string, options: (string | { value: string; label: string })[]): F => ({ k, p, c: (v) => ({ type: 'select', options, default: String(v) }) })
const xyz = (k: string, p: string, r: number, step = 0.01): F[] => ['X', 'Y', 'Z'].map((a, i) => num(`${k}${a}`, `${p}.${i}`, -r, r, step))

const eq = (a: any, b: any) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-6 : a === b)
const dialPath = (g: G, f: F) => (g.folder ? `${g.folder}.${f.k}` : f.k)
function flat(groups: G[], values: any): Record<string, any> {
  const out: Record<string, any> = {}
  for (const g of groups) for (const f of g.fields) out[dialPath(g, f)] = g.folder ? values?.[g.folder]?.[f.k] : values?.[f.k]
  return out
}

function useBinding(name: string, id: string, groups: G[], source: any, write: (path: string, v: any, f: F) => void, actions: Record<string, () => void> = {}, extra: Record<string, any> = {}) {
  const config = useMemo(() => {
    const cfg: any = {}
    for (const g of groups) {
      const tgt = g.folder ? (cfg[g.folder] ??= g.collapsed ? { _collapsed: true } : {}) : cfg
      for (const f of g.fields) tgt[f.k] = f.c(getPath(source, f.p))
    }
    for (const a of Object.keys(actions)) cfg[a] = { type: 'action' }
    return { ...cfg, ...extra }
    // la forma del panel se fija al montar; los valores se sincronizan abajo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const acts = useRef(actions); acts.current = actions
  const dial = useDialKitController(name, config, { id, onAction: (a) => acts.current[a]?.() })
  const prev = useRef<Record<string, any> | null>(null)
  const writeRef = useRef(write); writeRef.current = write

  // escena -> panel (deshacer, playhead, órbita, presets)
  useEffect(() => {
    const cur = flat(groups, dial.getValues())
    const upd: any = {}
    let any = false
    for (const g of groups) for (const f of g.fields) {
      const want = getPath(source, f.p)
      if (want === undefined || eq(cur[dialPath(g, f)], want)) continue
      if (g.folder) (upd[g.folder] ??= {})[f.k] = want; else upd[f.k] = want
      any = true
    }
    if (any) { dial.setValues(upd); prev.current = flat(groups, dial.getValues()) }
    else if (!prev.current) prev.current = cur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  // panel -> escena: sólo las claves que tocó la persona
  useEffect(() => {
    const cur = flat(groups, dial.values), p = prev.current
    prev.current = cur
    if (!p) return
    for (const g of groups) for (const f of g.fields) {
      const d = dialPath(g, f)
      if (cur[d] !== undefined && !eq(cur[d], p[d]) && !eq(cur[d], getPath(source, f.p))) writeRef.current(f.p, cur[d], f)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dial.values])
  return dial
}

const MATERIAL: G = {
  folder: 'material', fields: [
    sel('tipo', 'material.preset', MATERIAL_NAMES), color('color', 'material.color'),
    num('rugosidad', 'material.roughness', 0, 1), num('metal', 'material.metalness', 0, 1), num('transmisión', 'material.transmission', 0, 1),
    num('ior', 'material.ior', 1, 2.5, 0.01), num('dispersión', 'material.dispersion', 0, 1), num('iridiscencia', 'material.iridescence', 0, 1),
    num('película', 'material.film', 150, 900, 5), num('emisión', 'material.emission', 0, 20, 0.1), num('densidad', 'material.density', 0, 3, 0.01), num('rayones', 'material.scratches', 0, 1),
  ],
}

function groupsFor(l: Layer): G[] {
  if (isShape(l)) {
    const own: Record<string, F[]> = {
      sphere: [num('radio', 'radius', 0.1, 4, 0.01)],
      torus: [num('radio', 'radius', 0.2, 4, 0.01), num('grosor', 'tube', 0.02, 2, 0.01)],
      capsule: [num('radio', 'radius', 0.05, 2, 0.01), num('largo', 'length', 0, 6, 0.01)],
      blob: [num('morph', 'morph', 0, 1, 0.001), num('radio', 'radius', 0.1, 2, 0.01), num('gotas', 'count', 1, 8, 1), num('dispersión', 'spread', 0, 3, 0.01), num('suavidad', 'smooth', 0.01, 2, 0.01), num('semilla', 'seed', 0, 50, 1)],
      text: [text('texto', 'text'), num('alto', 'height', 0.3, 6, 0.01), num('profundidad', 'depth', 0.02, 3, 0.01), num('bisel', 'round', 0, 0.3, 0.005)],
      dish: [num('radio', 'radius', 0.2, 4, 0.01), num('alto', 'height', 0.04, 3, 0.01), bool('hueco', 'hollow'), num('pared', 'wall', 0.01, 1, 0.005), num('bisel', 'round', 0, 0.3, 0.005)],
      box: [num('ancho', 'size.0', 0.05, 6, 0.01), num('alto', 'size.1', 0.05, 6, 0.01), num('fondo', 'size.2', 0.05, 6, 0.01), num('bisel', 'round', 0, 1, 0.005)],
    }
    return [
      { fields: own[l.kind] },
      { folder: 'transformación', fields: [...xyz('posición', 'position', 8), ...xyz('rotación', 'rotation', 360, 1), num('escala', 'scale', 0.1, 4, 0.01), num('fusiónLíquida', 'merge', 0, 1.5, 0.01)] },
      MATERIAL,
    ]
  }
  if (l.kind === 'area') return [{ fields: [num('intensidad', 'intensity', 0, 40, 0.1), num('ancho', 'width', 0.1, 12, 0.05), num('alto', 'height', 0.1, 12, 0.05), num('blanco', 'white', 0, 1), bool('visibleEnCámara', 'seen')] }, { folder: 'posición', fields: xyz('', 'position', 12, 0.05).map((f, i) => ({ ...f, k: 'xyz'[i] })) }, { folder: 'apuntaA', fields: xyz('', 'target', 8, 0.05).map((f, i) => ({ ...f, k: 'xyz'[i] })) }]
  if (l.kind === 'spot') return [{ fields: [num('intensidad', 'intensity', 0, 40, 0.1), num('ángulo', 'angle', 5, 120, 1), num('suavidad', 'softness', 0, 1), num('radio', 'radius', 0.05, 2, 0.01), num('blanco', 'white', 0, 1)] }, { folder: 'posición', fields: xyz('', 'position', 12, 0.05).map((f, i) => ({ ...f, k: 'xyz'[i] })) }, { folder: 'apuntaA', fields: xyz('', 'target', 8, 0.05).map((f, i) => ({ ...f, k: 'xyz'[i] })) }]
  if (l.kind === 'hdri') return [{ fields: [sel('entorno', 'preset', ['estudio', 'softboxes', 'horizonte', 'anillo', 'uniforme']), num('intensidad', 'intensity', 0, 4, 0.01), num('rotación', 'rotation', -180, 180, 1), num('tinteDePaleta', 'tint', 0, 1), bool('visibleDeFondo', 'background')] }]
  return [{ fields: [bool('piso', 'floor'), num('alturaDelPiso', 'floorY', -6, 2, 0.01), num('rugosidad', 'roughness', 0, 1), num('metal', 'metalness', 0, 1)] }]
}

function pickHdr() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.hdr'
  inp.onchange = async () => {
    const file = inp.files?.[0]; if (!file) return
    const { RGBELoader } = await import('three/examples/jsm/loaders/RGBELoader.js')
    const url = URL.createObjectURL(file)
    new RGBELoader().load(url, (tex) => { rt.engine?.setCustomEnv(tex); URL.revokeObjectURL(url); toast('HDRI cargado para esta sesión (no se guarda en la escena)') }, undefined, () => toast('No se pudo leer el archivo .hdr'))
  }
  inp.click()
}

function LayerPanel({ layer }: { layer: Layer }) {
  const groups = useMemo(() => groupsFor(layer), [layer.kind]) // eslint-disable-line react-hooks/exhaustive-deps
  const actions: Record<string, () => void> = layer.kind === 'hdri' ? { cargarArchivoHdr: pickHdr, quitarArchivoHdr: () => rt.engine?.setCustomEnv(null) } : {}
  useBinding(`${KIND_LABEL[layer.kind]} · ${layer.name}`, `layer-${layer.id}`, groups, layer, (path, v, f) => {
    if (path === 'material.preset') return patchLayer(layer.id, { material: { ...MATERIALS[v as string] } } as Partial<Layer>)
    if (f.num) setProp(layer.id, path, v as number)
    else setLayerField(layer.id, path, v)
  }, actions)
  return null
}

const CAMERA: G[] = [{ fields: [num('órbita', 'azimuth', -360, 360, 0.5), num('elevación', 'polar', 1, 179, 0.5), num('distancia', 'distance', 1, 60, 0.05), num('focal', 'focal', 18, 200, 1), bool('profundidadDeCampo', 'dof'), num('apertura', 'fstop', 0.7, 16, 0.1), num('foco', 'focus', 0.5, 60, 0.05)] }]
function CameraPanel({ scene }: { scene: Scene }) {
  useBinding('Cámara', 'camera', CAMERA, scene.camera, (path, v, f) => {
    if (f.num) setProp('camera', path, v as number)
    else edit((s) => ({ ...s, camera: { ...s.camera, [path]: v } }))
  }, { guardarEncuadre: saveFraming })
  return null
}

const SCENE: G[] = [{ fields: [
  text('nombre', 'name'), sel('formato', 'format', Object.entries(FORMATS).map(([value, f]) => ({ value, label: f.label }))),
  sel('paleta', 'palette.pair', PAIRS.map((p, i) => ({ value: String(i), label: p.name }))), bool('invertirPaleta', 'palette.invert'),
  num('duración', 'anim.duration', 1, 12, 0.5), sel('cuadrosPorSegundo', 'anim.fps', ['24', '30', '60']),
] }]
function ScenePanel({ scene }: { scene: Scene }) {
  const src = useMemo(() => ({ ...scene, palette: { ...scene.palette, pair: String(scene.palette.pair) }, anim: { ...scene.anim, fps: String(scene.anim.fps) } }), [scene])
  useBinding('Escena', 'scene', SCENE, src, (path, v) => edit((s) => {
    if (path === 'name') return { ...s, name: v }
    if (path === 'format') return { ...s, format: v }
    if (path === 'palette.pair') return { ...s, palette: { ...s.palette, pair: Number(v) } }
    if (path === 'palette.invert') return { ...s, palette: { ...s.palette, invert: v } }
    if (path === 'anim.duration') return { ...s, anim: { ...s.anim, duration: v } }
    return { ...s, anim: { ...s.anim, fps: Number(v) } }
  }, `scene.${path}`), { paletaAlAzar: randomPalette })
  return null
}

const RENDER: G[] = [{ fields: [
  num('muestras', 'samples', 8, 2048, 8), num('rebotes', 'bounces', 2, 24, 1), num('denoiser', 'denoise', 0, 1), num('exposición', 'exposure', 0.2, 4, 0.01),
  num('bloom', 'bloom', 0, 1.5, 0.01), num('radioDelBloom', 'bloomRadius', 0.5, 3, 0.01), num('grano', 'grain', 0, 1), num('viñeta', 'vignette', 0, 1),
] }]
function RenderPanel({ scene }: { scene: Scene }) {
  useBinding('Render', 'render', RENDER, scene.render, (path, v) => edit((s) => ({ ...s, render: { ...s.render, [path]: v } }), `render.${path}`))
  return null
}

function KeyPanel({ scene, trackId, index }: { scene: Scene; trackId: string; index: number }) {
  const tr = scene.anim.tracks.find((t) => t.id === trackId)!
  const key = tr.keys[index]
  const layer = scene.layers.find((l) => l.id === tr.target)
  const label = `${layer ? layer.name : 'Cámara'} · ${propLabel(layer ? layer.kind : 'camera', tr.prop)}`
  const range = tr.prop.startsWith('rotation') || tr.prop === 'azimuth' ? [-720, 720, 1] : tr.prop === 'morph' ? [0, 4, 0.01] : tr.prop === 'focal' ? [18, 200, 1] : tr.prop === 'polar' ? [1, 179, 0.5] : [-20, 60, 0.01]
  const groups = useMemo<G[]>(() => [{ fields: [num('valor', 'v', range[0], range[1], range[2])] }], []) // eslint-disable-line react-hooks/exhaustive-deps
  const span = scene.anim.duration * ((tr.keys[index + 1]?.t ?? 1 + tr.keys[0].t) - key.t)
  const dial = useBinding(`Clave · ${label}`, `key-${trackId}-${index}`, groups, key, (_p, v) => patchKey(trackId, index, { v }), {
    eliminarClave: () => removeKey(trackId, index),
  }, { curva: { type: 'easing', duration: Math.max(0.05, span), ease: key.ease } })
  // la curva editable del panel -> easing de la clave
  const ease = (dial.values as any).curva?.ease as Ease | undefined
  const last = useRef(key.ease.join())
  useEffect(() => {
    if (!ease || ease.join() === last.current) return
    last.current = ease.join(); patchKey(trackId, index, { ease: [...ease] as Ease })
  }, [ease?.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (key.ease.join() === last.current) return
    last.current = key.ease.join(); dial.setValue('curva', { type: 'easing', duration: Math.max(0.05, span), ease: key.ease })
  }, [key.ease.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** Registra los paneles DialKit según la selección. No dibuja nada: DialRoot los muestra. */
export function Panels() {
  const scene = useStore((s) => s.scene)
  const time = useStore((s) => s.time)
  const selected = useStore((s) => s.selected)
  const selKey = useStore((s) => s.selKey)
  const rev = useStore((s) => s.rev)
  const resolved = useMemo(() => resolveScene(scene, time), [scene, time])
  const layer = resolved.layers.find((l) => l.id === selected)
  const keyOk = selKey && scene.anim.tracks.find((t) => t.id === selKey.track)?.keys[selKey.index]
  void rev
  // DialKit ordena los paneles por orden de registro: al cambiar la selección se montan todos de nuevo
  // para que la clave y la capa elegidas queden arriba.
  const order = `${keyOk ? `${selKey!.track}:${selKey!.index}` : ''}|${layer ? layer.id : ''}`
  return (
    <Fragment key={order}>
      {keyOk && <KeyPanel scene={scene} trackId={selKey!.track} index={selKey!.index} />}
      {layer && <LayerPanel layer={layer} />}
      <CameraPanel scene={resolved} />
      <ScenePanel scene={scene} />
      <RenderPanel scene={scene} />
    </Fragment>
  )
}
