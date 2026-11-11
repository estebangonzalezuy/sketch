import type { Engine } from '../engine/Engine'
import { resolveScene } from '../scene/animate'
import { FORMATS, type Scene } from '../scene/types'

const ch = new MessageChannel()
const waiters: (() => void)[] = []
ch.port1.onmessage = () => waiters.shift()?.()
/** Cede el hilo sin el mínimo de 4 ms de setTimeout. */
export const tick = () => new Promise<void>((r) => { waiters.push(r); ch.port2.postMessage(0) })

export class Cancelled extends Error {}
export interface Job { cancelled: boolean }

export function outputSize(scene: Scene, scale: number) {
  const f = FORMATS[scene.format]
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2)
  return { w: even(f.w), h: even(f.h) }
}

/** Renderiza un cuadro con path tracing hasta `spp` muestras y devuelve sus píxeles. */
export async function renderFrame(eng: Engine, scene: Scene, t: number, w: number, h: number, spp: number, job: Job, onSample?: (n: number) => void) {
  eng.setMode('final')
  eng.setSize(w, h)
  const rs = resolveScene(scene, t)
  eng.setScene({ ...rs, render: { ...rs.render, samples: spp } })
  eng.reset()
  let last = performance.now()
  while (!eng.done) {
    if (job.cancelled) throw new Cancelled()
    const full = eng.step()
    if (full) onSample?.(eng.samples)
    if (performance.now() - last > 24) { eng.renderer.getContext().flush(); await tick(); last = performance.now() }
  }
  return eng.readPixels()
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

export function pixelsToBlob(px: Uint8ClampedArray, w: number, h: number, type = 'image/png', q?: number): Promise<Blob> {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  cv.getContext('2d')!.putImageData(new ImageData(px as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0)
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo codificar la imagen'))), type, q))
}

export const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'escena'
