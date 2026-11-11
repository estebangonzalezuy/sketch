// Banco de pruebas del motor sin interfaz: /dev.html?preset=Discos&w=432&h=540&spp=16&mode=final&t=0
import '@fontsource/inter/800.css'
import { Engine } from './engine/Engine'
import { PRESETS } from './scene/presets'
import { resolveScene } from './scene/animate'

const q = new URLSearchParams(location.search)
const num = (k: string, d: number) => Number(q.get(k) ?? d)
const canvas = document.getElementById('c') as HTMLCanvasElement
;(async () => {
  await document.fonts.load('800 100px Inter')
  console.warn('fonts ok', performance.now()); const eng = new Engine(canvas)
  const p = PRESETS.find((x) => x.name === (q.get('preset') ?? 'Discos')) ?? PRESETS[0]
  const sc = p.build()
  sc.render.samples = num('spp', 16)
  if (q.has('bounces')) sc.render.bounces = num('bounces', 12)
  eng.setSize(num('w', 432), num('h', 540))
  eng.setMode((q.get('mode') as any) ?? 'final')
  eng.setScene(resolveScene(sc, num('t', 0)))
  console.warn('scene set', performance.now()); const t0 = performance.now()
  const loop = () => {
    eng.step(); eng.present()
    ;(window as any).__samples = eng.samples
    if (eng.done) { (window as any).__done = true; (window as any).__ms = performance.now() - t0; return }
    setTimeout(loop, 0)
  }
  loop()
})()
