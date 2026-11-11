import { area, backdrop, camera, hdri, scene, shape, spot, uid } from './defaults'
import { mat } from './materials'
import { LINEAR, EASES } from './animate'
import type { Ease, Scene, Track } from './types'

export interface Preset { name: string; tags: string; build: () => Scene }

const track = (target: string, prop: string, keys: [number, number, Ease?][]): Track => ({
  id: uid(), target, prop, keys: keys.map(([t, v, ease]) => ({ t, v, ease: ease ?? LINEAR })).sort((a, b) => a.t - b.t),
})

function discos(): Scene {
  const glass = mat('Vidrio tintado', { color: '#9a5cff', density: 2.6, iridescence: 0.2, film: 300, scratches: 0.15, dispersion: 0.8 })
  // Siete discos sobre una diagonal. Cada uno viaja hasta el lugar del siguiente: el loop cierra solo.
  const at = (k: number) => ({
    position: [k * 0.46, -k * 0.9, -k * 0.3] as [number, number, number],
    rotation: [52 - k * 7, 0, 22 - k * 3] as [number, number, number],
  })
  const dishes = Array.from({ length: 7 }, (_, i) =>
    shape('dish', { name: `Disco ${i + 1}`, radius: 1, height: 0.3, wall: 0.05, round: 0.02, ...at(i - 3), material: { ...glass } }))
  const tracks = dishes.flatMap((d, i) => {
    const a = at(i - 3), b = at(i - 4)
    return [
      track(d.id, 'position.0', [[0, a.position[0]], [1, b.position[0]]]),
      track(d.id, 'position.1', [[0, a.position[1]], [1, b.position[1]]]),
      track(d.id, 'position.2', [[0, a.position[2]], [1, b.position[2]]]),
      track(d.id, 'rotation.0', [[0, a.rotation[0]], [1, b.rotation[0]]]),
      track(d.id, 'rotation.2', [[0, a.rotation[2]], [1, b.rotation[2]]]),
    ]
  })
  return scene({
    name: 'Discos', palette: { pair: 0, invert: false },
    layers: [
      ...dishes,
      area({ name: 'Softbox', position: [-2.4, 4.6, 4.7], width: 4, height: 3, intensity: 6, white: 0 }),
      area({ name: 'Tira lateral', position: [5, 1, 3], width: 0.7, height: 6, intensity: 20, white: 0 }),
      area({ name: 'Tira baja', position: [-4.5, -3, 3], width: 0.6, height: 5, intensity: 12, white: 0 }),
      area({ name: 'Contra', position: [1, -3.5, -5], width: 6, height: 3, intensity: 7, white: 0 }),
      hdri({ preset: 'softboxes', intensity: 0.5, tint: 0.85 }),
      backdrop(),
    ],
    camera: camera({ azimuth: 0, polar: 90, distance: 13, focal: 80, target: [0, 0, 0] }),
    render: { samples: 256, bounces: 14, denoise: 0.5, exposure: 1.25, bloom: 0.5, bloomRadius: 1.3, grain: 0.1, vignette: 0.2 },
    anim: { duration: 3, fps: 30, tracks },
  })
}

const S = EASES.Suave
const spin = (id: string, axis: 0 | 1 | 2, from = 0, turns = 1) => track(id, `rotation.${axis}`, [[0, from], [1, from + 360 * turns]])
const sway = (id: string, prop: string, a: number, b: number, phase = 0) => track(id, prop, [[phase, a, S], [(phase + 0.5) % 1, b, S]])
// órbita circular con dos pistas desfasadas un cuarto de vuelta
const orbit = (id: string, r: number, phase = 0, y = 'position.2') => [sway(id, 'position.0', r, -r, phase), sway(id, y, r, -r, (phase + 0.25) % 1)]
const studio = (k = 1) => [
  area({ name: 'Softbox', position: [-3.5, 4.5, 4], width: 5, height: 4, intensity: 5 * k, white: 0.3 }),
  area({ name: 'Tira', position: [5, 1, 2.5], width: 0.8, height: 6, intensity: 12 * k }),
  area({ name: 'Contra', position: [0.5, 2.5, -5.5], width: 6, height: 2.5, intensity: 6 * k, white: 0.1 }),
]

function metalLiquido(): Scene {
  const b = shape('blob', { name: 'Metal', radius: 0.95, count: 6, spread: 1.15, smooth: 0.9, seed: 4, material: mat('Metal líquido') })
  return scene({
    name: 'Metal líquido', palette: { pair: 0, invert: false },
    layers: [b, ...studio(1.1), hdri({ preset: 'softboxes', intensity: 1, tint: 0.2 }), backdrop({ floor: true, floorY: -2.3, roughness: 0.9 })],
    camera: camera({ azimuth: 20, polar: 78, distance: 11, focal: 60 }),
    render: { samples: 192, bounces: 6, denoise: 0.5, exposure: 1, bloom: 0.3, bloomRadius: 1.2, grain: 0.1, vignette: 0.3 },
    anim: { duration: 4, fps: 30, tracks: [track(b.id, 'morph', [[0, 0], [1, 1]]), spin(b.id, 1)] },
  })
}
function gota(): Scene {
  const b = shape('blob', { name: 'Gota', radius: 0.9, count: 4, spread: 0.85, smooth: 1.1, seed: 9, material: mat('Iridiscente', { film: 430 }) })
  return scene({
    name: 'Gota iridiscente', palette: { pair: 3, invert: false },
    layers: [b, ...studio(1), hdri({ preset: 'estudio', intensity: 0.8, tint: 0.7 }), backdrop()],
    camera: camera({ azimuth: -15, polar: 80, distance: 10, focal: 65 }),
    anim: { duration: 4, fps: 30, tracks: [track(b.id, 'morph', [[0, 0], [1, 1]])] },
  })
}
function toro(): Scene {
  const t = shape('torus', { name: 'Toro', radius: 1.45, tube: 0.52, rotation: [28, 0, 18], material: mat('Vidrio', { dispersion: 1, color: '#f2ffe0', density: 0.5 }) })
  const c = shape('sphere', { name: 'Núcleo', radius: 0.42, material: mat('Emisivo', { color: '#f0ff9a', emission: 5 }) })
  return scene({
    name: 'Toro de vidrio', palette: { pair: 1, invert: false },
    layers: [t, c, ...studio(0.9), hdri({ preset: 'anillo', intensity: 0.7, tint: 0.8 }), backdrop()],
    camera: camera({ azimuth: 0, polar: 82, distance: 10.5, focal: 60 }),
    anim: { duration: 4, fps: 30, tracks: [track(t.id, 'rotation.0', [[0, 28], [1, 388]]), sway(c.id, 'scale', 1, 1.25)] },
  })
}
function capsulas(): Scene {
  const cols = ['#d9d4c8', '#cc84fc', '#3c240c', '#efe9dc', '#cc84fc']
  const caps = cols.map((color, i) => shape('capsule', {
    name: `Cápsula ${i + 1}`, radius: 0.42, length: 1.5 + (i % 2) * 0.5, position: [(i - 2) * 1.05, -0.2 + (i % 2) * 0.3, 0], rotation: [0, 0, (i - 2) * 6],
    material: i === 2 ? mat('Metal líquido', { color: '#e8d9c8' }) : mat('Plástico mate', { color }),
  }))
  return scene({
    name: 'Cápsulas', palette: { pair: 2, invert: false },
    layers: [...caps, ...studio(1), hdri({ preset: 'estudio', intensity: 0.7, tint: 0.4 }), backdrop({ floor: true, floorY: -1.75, roughness: 0.9 })],
    camera: camera({ azimuth: 12, polar: 74, distance: 12, focal: 60 }),
    render: { samples: 256, bounces: 6, denoise: 0.6, exposure: 1, bloom: 0.2, bloomRadius: 1.2, grain: 0.1, vignette: 0.3 },
    anim: { duration: 3, fps: 30, tracks: caps.map((c, i) => sway(c.id, 'position.1', c.position[1], c.position[1] + 0.7, i * 0.12)) },
  })
}
function tipografia(): Scene {
  const t = shape('text', { name: 'Texto', text: 'vitro', height: 4.4, depth: 0.9, round: 0.05, material: mat('Vidrio', { dispersion: 1, color: '#ffffff' }) })
  return scene({
    name: 'Tipografía de vidrio', format: '1920x1080', palette: { pair: 0, invert: false },
    layers: [t, area({ name: 'Tira alta', position: [0, 4.5, 2], width: 9, height: 0.7, intensity: 14 }), area({ name: 'Tira baja', position: [0, -4, 3], width: 9, height: 0.6, intensity: 8 }),
      area({ name: 'Contra', position: [0, 0, -6], width: 8, height: 3, intensity: 3 }), hdri({ preset: 'horizonte', intensity: 0.6, tint: 0 }), backdrop()],
    camera: camera({ azimuth: 0, polar: 88, distance: 11, focal: 50 }),
    anim: { duration: 4, fps: 30, tracks: [sway(t.id, 'rotation.1', -24, 24), sway(t.id, 'rotation.0', -6, 6, 0.25)] },
  })
}
function textoCromo(): Scene {
  const t = shape('text', { name: 'Texto', text: 'LOOP', height: 4, depth: 1.1, round: 0.08, material: mat('Cromo iridiscente') })
  return scene({
    name: 'Texto cromado', format: '1920x1080', palette: { pair: 3, invert: false },
    layers: [t, ...studio(1), hdri({ preset: 'softboxes', intensity: 1.2, tint: 0.8 }), backdrop({ floor: true, floorY: -1.5, roughness: 0.9 })],
    camera: camera({ azimuth: 0, polar: 82, distance: 11, focal: 50 }),
    render: { samples: 192, bounces: 6, denoise: 0.5, exposure: 1, bloom: 0.3, bloomRadius: 1.2, grain: 0.1, vignette: 0.3 },
    anim: { duration: 4, fps: 30, tracks: [track('camera', 'azimuth', [[0, -28, S], [0.5, 28, S]])] },
  })
}
function anillos(): Scene {
  const rings = [1.9, 1.4, 0.9].map((r, i) => shape('torus', { name: `Anillo ${i + 1}`, radius: r, tube: 0.13, rotation: [i * 40, 0, i * 30], material: mat(i === 1 ? 'Cromo iridiscente' : 'Metal líquido') }))
  const core = shape('sphere', { name: 'Esfera', radius: 0.45, material: mat('Vidrio', { dispersion: 1 }) })
  return scene({
    name: 'Anillos', palette: { pair: 1, invert: false },
    layers: [...rings, core, ...studio(1), hdri({ preset: 'softboxes', intensity: 1.1, tint: 0.7 }), backdrop()],
    camera: camera({ azimuth: 15, polar: 76, distance: 11.5, focal: 60 }),
    render: { samples: 192, bounces: 8, denoise: 0.5, exposure: 1, bloom: 0.35, bloomRadius: 1.2, grain: 0.1, vignette: 0.3 },
    anim: { duration: 4, fps: 30, tracks: [spin(rings[0].id, 0, 0), spin(rings[1].id, 2, 30), spin(rings[2].id, 0, 80, -1)] },
  })
}
function lente(): Scene {
  const l = shape('dish', { name: 'Lente', radius: 1.7, height: 0.5, hollow: false, round: 0.22, rotation: [78, 0, 0], material: mat('Vidrio', { dispersion: 1, ior: 1.6 }) })
  const balls = [-1, 0, 1].map((k) => shape('sphere', { name: `Esfera ${k + 2}`, radius: 0.5, position: [k * 1.3, 0, -2.2], material: k === 0 ? mat('Emisivo', { color: '#e9c8ff', emission: 4 }) : mat('Plástico mate', { color: k < 0 ? '#cc84fc' : '#f3e9dc' }) }))
  return scene({
    name: 'Lente', palette: { pair: 2, invert: false },
    layers: [l, ...balls, ...studio(1), hdri({ preset: 'estudio', intensity: 0.6, tint: 0.6 }), backdrop()],
    camera: camera({ azimuth: 0, polar: 86, distance: 10, focal: 55 }),
    anim: { duration: 4, fps: 30, tracks: [sway(l.id, 'rotation.2', -30, 30), sway(l.id, 'position.0', -0.9, 0.9, 0.25)] },
  })
}
function fusion(): Scene {
  const m = mat('Metal líquido', { color: '#f1e4ff', roughness: 0.05 })
  const a = shape('sphere', { name: 'Esfera', radius: 1.05, merge: 0.8, material: { ...m } })
  const b = shape('torus', { name: 'Toro', radius: 1.5, tube: 0.3, merge: 0.8, rotation: [70, 0, 0], material: { ...m } })
  const c = shape('capsule', { name: 'Cápsula', radius: 0.4, length: 1.2, merge: 0.8, position: [1.6, 0.6, 0], material: { ...m } })
  return scene({
    name: 'Fusión líquida', palette: { pair: 2, invert: false },
    layers: [a, b, c, ...studio(1), hdri({ preset: 'softboxes', intensity: 1.1, tint: 0.8 }), backdrop()],
    camera: camera({ azimuth: 10, polar: 78, distance: 14, focal: 60 }),
    render: { samples: 192, bounces: 6, denoise: 0.5, exposure: 1, bloom: 0.3, bloomRadius: 1.2, grain: 0.1, vignette: 0.3 },
    anim: { duration: 4, fps: 30, tracks: [...orbit(c.id, 1.9, 0, 'position.1'), spin(b.id, 0, 70), sway(a.id, 'scale', 1, 0.82)] },
  })
}
function perla(): Scene {
  const box = shape('box', { name: 'Cubo', size: [2.4, 2.4, 2.4], round: 0.28, rotation: [20, 30, 0], material: mat('Vidrio', { dispersion: 0.9, color: '#ffe3f6', density: 0.25 }) })
  const pearl = shape('sphere', { name: 'Perla', radius: 0.5, material: mat('Emisivo', { color: '#ffb6ea', emission: 7 }) })
  return scene({
    name: 'Perla emisiva', palette: { pair: 3, invert: false },
    layers: [box, pearl, area({ name: 'Softbox', position: [-3.5, 4.5, 4], width: 5, height: 4, intensity: 3, white: 0.4 }), hdri({ preset: 'estudio', intensity: 0.5, tint: 0.8 }), backdrop()],
    camera: camera({ azimuth: 0, polar: 80, distance: 10.5, focal: 60 }),
    anim: { duration: 4, fps: 30, tracks: [track(box.id, 'rotation.1', [[0, 30], [1, 120]]), sway(pearl.id, 'scale', 1, 1.35)] },
  })
}
function hielo(): Scene {
  const cubes = [[-1.3, -0.3, 0.2, 12], [0.2, -0.3, -0.5, -20], [-0.4, 1.05, -0.1, 35]].map(([x, y, z, r], i) =>
    shape('box', { name: `Cubo ${i + 1}`, size: [1.3, 1.3, 1.3], round: 0.14, position: [x, y, z], rotation: [0, r, i === 2 ? 8 : 0], material: mat(i === 1 ? 'Vidrio' : 'Vidrio esmerilado', { roughness: i === 1 ? 0 : 0.22 }) }))
  return scene({
    name: 'Cubos de hielo', palette: { pair: 0, invert: false },
    layers: [...cubes, ...studio(1.1), hdri({ preset: 'estudio', intensity: 0.8, tint: 0 }), backdrop({ floor: true, floorY: -0.95, roughness: 0.9 })],
    camera: camera({ azimuth: 24, polar: 70, distance: 10.5, focal: 60, dof: true, fstop: 1.8, focus: 10.3 }),
    anim: { duration: 6, fps: 30, tracks: [track('camera', 'azimuth', [[0, 24], [1, 384]])] },
  })
}
function orbita(): Scene {
  const big = shape('sphere', { name: 'Esfera', radius: 1.25, material: mat('Vidrio', { dispersion: 1 }) })
  const sats = [0, 1, 2].map((i) => shape('sphere', { name: `Satélite ${i + 1}`, radius: 0.26, position: [2.2, (i - 1) * 0.55, 0], material: i === 1 ? mat('Emisivo', { color: '#f3ff8a', emission: 6 }) : mat('Metal líquido') }))
  return scene({
    name: 'Órbita', palette: { pair: 1, invert: false },
    layers: [big, ...sats, ...studio(1), hdri({ preset: 'anillo', intensity: 0.8, tint: 0.6 }), backdrop()],
    camera: camera({ azimuth: 0, polar: 60, distance: 12, focal: 60 }),
    render: { samples: 192, bounces: 8, denoise: 0.5, exposure: 1, bloom: 0.4, bloomRadius: 1.2, grain: 0.1, vignette: 0.3 },
    anim: { duration: 4, fps: 30, tracks: sats.flatMap((s, i) => orbit(s.id, 2.2, i / 3)) },
  })
}
function monolito(): Scene {
  const c = shape('capsule', { name: 'Monolito', radius: 0.7, length: 2.4, material: mat('Iridiscente', { film: 520, density: 0.4, color: '#e9dcff' }) })
  return scene({
    name: 'Monolito', format: '1080x1920', palette: { pair: 2, invert: false },
    layers: [c, spot({ name: 'Cenital', position: [0.8, 6, 1.5], angle: 46, softness: 0.6, intensity: 10, white: 0.2 }), area({ name: 'Contra', position: [-4, 1.5, -4], width: 2, height: 6, intensity: 8 }),
      hdri({ preset: 'horizonte', intensity: 0.45, tint: 0.8 }), backdrop({ floor: true, floorY: -1.9, roughness: 0.9 })],
    camera: camera({ azimuth: 18, polar: 80, distance: 13, focal: 50 }),
    anim: { duration: 4, fps: 30, tracks: [sway(c.id, 'position.1', 0, 0.45), sway(c.id, 'rotation.2', -7, 7, 0.25)] },
  })
}
function discosLima(): Scene {
  const s = discos()
  s.name = 'Discos lima'; s.palette = { pair: 1, invert: false }
  for (const l of s.layers) if (l.kind === 'dish') l.material = mat('Vidrio', { dispersion: 1, color: '#eaffb0', density: 1.2, scratches: 0.15 })
  return s
}

export const PRESETS: Preset[] = [
  { name: 'Discos', tags: 'vidrio discos tintado apilado loop', build: discos },
  { name: 'Metal líquido', tags: 'blob metal cromo morph piso', build: metalLiquido },
  { name: 'Gota iridiscente', tags: 'blob iridiscente vidrio morph', build: gota },
  { name: 'Toro de vidrio', tags: 'toro vidrio dispersión emisivo', build: toro },
  { name: 'Tipografía de vidrio', tags: 'texto vidrio dispersión horizontal', build: tipografia },
  { name: 'Texto cromado', tags: 'texto cromo iridiscente cámara', build: textoCromo },
  { name: 'Fusión líquida', tags: 'líquido metal fusión esfera toro cápsula', build: fusion },
  { name: 'Anillos', tags: 'toro metal cromo giro', build: anillos },
  { name: 'Lente', tags: 'disco lente vidrio dispersión esferas', build: lente },
  { name: 'Cápsulas', tags: 'cápsula plástico mate piso', build: capsulas },
  { name: 'Perla emisiva', tags: 'caja vidrio emisivo esfera', build: perla },
  { name: 'Cubos de hielo', tags: 'caja vidrio esmerilado piso foco', build: hielo },
  { name: 'Órbita', tags: 'esfera vidrio metal emisivo órbita', build: orbita },
  { name: 'Monolito', tags: 'cápsula iridiscente spot vertical piso', build: monolito },
  { name: 'Discos lima', tags: 'vidrio discos lima apilado', build: discosLima },
]
