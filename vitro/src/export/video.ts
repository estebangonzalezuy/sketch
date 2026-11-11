import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import type { Engine } from '../engine/Engine'
import type { Scene } from '../scene/types'
import { Cancelled, pixelsToBlob, renderFrame, type Job } from './render'

export interface VideoProgress { frame: number; frames: number; encoder: string; eta: number }

interface Sink { name: string; add(px: Uint8ClampedArray, i: number): Promise<void>; finish(): Promise<Blob> }

async function webCodecsSink(w: number, h: number, fps: number): Promise<Sink | null> {
  if (typeof VideoEncoder === 'undefined') return null
  const bitrate = Math.round(w * h * fps * 0.22)
  let config: VideoEncoderConfig | null = null
  for (const codec of ['avc1.640033', 'avc1.640028', 'avc1.4d0028', 'avc1.42e028']) {
    const c: VideoEncoderConfig = { codec, width: w, height: h, bitrate, framerate: fps }
    try { if ((await VideoEncoder.isConfigSupported(c)).supported) { config = c; break } } catch { /* siguiente perfil */ }
  }
  if (!config) return null
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: w, height: h, frameRate: fps }, fastStart: 'in-memory' })
  let error: Error | null = null
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { error = e } })
  enc.configure(config)
  const dt = 1e6 / fps
  return {
    name: 'WebCodecs (H.264)',
    async add(px, i) {
      if (error) throw error
      const frame = new VideoFrame(px, { format: 'RGBA', codedWidth: w, codedHeight: h, timestamp: Math.round(i * dt), duration: Math.round(dt) })
      enc.encode(frame, { keyFrame: i % 30 === 0 }); frame.close()
      while (enc.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 4))
    },
    async finish() {
      await enc.flush(); enc.close()
      if (error) throw error
      muxer.finalize()
      return new Blob([muxer.target.buffer], { type: 'video/mp4' })
    },
  }
}

async function ffmpegSink(w: number, h: number, fps: number): Promise<Sink> {
  const [{ FFmpeg }, coreURL, wasmURL] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/core?url').then((m) => m.default),
    import('@ffmpeg/core/wasm?url').then((m) => m.default),
  ])
  const ff = new FFmpeg()
  await ff.load({ coreURL, wasmURL })
  let n = 0
  return {
    name: 'ffmpeg.wasm (libx264)',
    async add(px, i) {
      const blob = await pixelsToBlob(px, w, h, 'image/png')
      await ff.writeFile(`f${String(i).padStart(5, '0')}.png`, new Uint8Array(await blob.arrayBuffer())); n++
    },
    async finish() {
      const code = await ff.exec(['-framerate', String(fps), '-i', 'f%05d.png', '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'out.mp4'])
      if (code !== 0) throw new Error('ffmpeg no pudo codificar el video')
      const data = (await ff.readFile('out.mp4')) as Uint8Array
      for (let i = 0; i < n; i++) await ff.deleteFile(`f${String(i).padStart(5, '0')}.png`)
      ff.terminate()
      return new Blob([data.slice().buffer], { type: 'video/mp4' })
    },
  }
}

/** Renderiza el loop cuadro por cuadro y lo codifica en MP4 (WebCodecs, o ffmpeg.wasm si no hay H.264). */
export async function exportMp4(eng: Engine, scene: Scene, w: number, h: number, spp: number, job: Job, onProgress: (p: VideoProgress) => void, force?: 'ffmpeg'): Promise<Blob> {
  const fps = scene.anim.fps
  const frames = Math.max(2, Math.round(scene.anim.duration * fps))
  const sink = (force === 'ffmpeg' ? null : await webCodecsSink(w, h, fps)) ?? (await ffmpegSink(w, h, fps))
  const t0 = performance.now()
  for (let i = 0; i < frames; i++) {
    if (job.cancelled) throw new Cancelled()
    // t = i / frames: el último cuadro queda un paso antes del primero y el loop no repite cuadro
    const px = await renderFrame(eng, scene, i / frames, w, h, spp, job)
    await sink.add(px, i)
    const el = (performance.now() - t0) / 1000
    onProgress({ frame: i + 1, frames, encoder: sink.name, eta: (el / (i + 1)) * (frames - i - 1) })
  }
  return sink.finish()
}
