import { Engine } from './engine/Engine'
import { resolveScene } from './scene/animate'
import { exportMp4, type VideoProgress } from './export/video'
import { Cancelled, download, outputSize, pixelsToBlob, renderFrame, slug, type Job } from './export/render'
import { useStore, toast } from './store'

// Un solo motor para la vista y para las exportaciones.
export const rt = {
  engine: null as Engine | null,
  view: { w: 2, h: 2 }, // tamaño de render de la vista, en píxeles
  interacting: false,
  job: null as Job | null,
}

let raf = 0, lastT = 0, perFrame = 1, lastSamples = -1
function frame(now: number) {
  raf = requestAnimationFrame(frame)
  const eng = rt.engine; if (!eng) return
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now
  const st = useStore.getState()
  if (st.busy) return
  if (st.playing) useStore.setState({ time: (st.time + dt / st.scene.anim.duration) % 1 })
  const mode = st.playing || rt.interacting ? 'preview' : st.mode
  eng.setMode(mode)
  eng.setSize(rt.view.w, rt.view.h)
  eng.setScene(resolveScene(st.scene, useStore.getState().time))
  if (!eng.done) {
    // más muestras por cuadro si la GPU va sobrada, menos si se ahoga
    if (mode === 'final') perFrame = dt < 0.024 ? Math.min(6, perFrame + 1) : dt > 0.05 ? Math.max(1, perFrame - 1) : perFrame
    const n = mode === 'final' ? perFrame : 1
    for (let i = 0; i < n && !eng.done; i++) eng.step()
    eng.present()
  } else if (eng.postDirty) eng.present()
  if (eng.samples !== lastSamples) { lastSamples = eng.samples; useStore.setState({ samples: eng.samples }) }
}

export function attach(canvas: HTMLCanvasElement) {
  rt.engine = new Engine(canvas)
  document.fonts?.load('800 100px Inter').then(() => { (rt.engine as any).textKey = ''; (rt.engine as any).key = '' })
  cancelAnimationFrame(raf); raf = requestAnimationFrame(frame)
  return () => { cancelAnimationFrame(raf); rt.engine?.dispose(); rt.engine = null }
}

async function run<T>(label: string, fn: (job: Job, eng: Engine) => Promise<T>): Promise<T | null> {
  const eng = rt.engine
  if (!eng || rt.job) return null
  const job: Job = { cancelled: false }; rt.job = job
  useStore.setState({ busy: { label, progress: 0 }, playing: false })
  try { return await fn(job, eng) } catch (e) {
    if (!(e instanceof Cancelled)) { console.error(e); toast(`Falló la exportación: ${(e as Error).message}`) }
    return null
  } finally {
    rt.job = null; eng.setSize(rt.view.w, rt.view.h); (eng as any).key = ''
    useStore.setState({ busy: null })
  }
}
export const cancelJob = () => { if (rt.job) rt.job.cancelled = true }
const busy = (label: string, progress: number) => useStore.setState({ busy: { label, progress } })

export function maxScale() {
  const gl = rt.engine?.renderer.getContext(); if (!gl) return 1
  const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
  const s = useStore.getState().scene
  return max >= Math.max(outputSize(s, 2).w, outputSize(s, 2).h) ? 2 : 1
}

export async function renderPng(scale: number, spp: number): Promise<Blob | null> {
  const st = useStore.getState(), { w, h } = outputSize(st.scene, scale)
  return run('PNG', async (job, eng) => {
    const px = await renderFrame(eng, st.scene, st.time, w, h, spp, job, (n) => busy(`PNG ${w}×${h} · muestra ${n} de ${spp}`, n / spp))
    return pixelsToBlob(px, w, h)
  })
}
export async function renderMp4(scale: number, spp: number, force?: 'ffmpeg'): Promise<Blob | null> {
  const st = useStore.getState(), { w, h } = outputSize(st.scene, scale)
  return run('MP4', async (job, eng) => {
    busy('Preparando el codificador…', 0)
    return exportMp4(eng, st.scene, w, h, spp, job, (p: VideoProgress) => {
      const m = Math.floor(p.eta / 60), s = Math.round(p.eta % 60)
      busy(`MP4 ${w}×${h} · cuadro ${p.frame} de ${p.frames} · ${p.encoder} · faltan ${m ? `${m} min ` : ''}${s} s`, p.frame / p.frames)
    }, force)
  })
}
export async function savePng(scale: number, spp: number) {
  const b = await renderPng(scale, spp); if (b) { download(b, `${slug(useStore.getState().scene.name)}.png`); toast('PNG exportado') }
}
export async function saveMp4(scale: number, spp: number) {
  const b = await renderMp4(scale, spp); if (b) { download(b, `${slug(useStore.getState().scene.name)}.mp4`); toast('MP4 exportado') }
}
