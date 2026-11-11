import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import type { Params } from "./harmono";
import { Renderer, W, H } from "./draw";

/** MP4 1080×1350 30 fps H.264 con WebCodecs. Si el navegador no tiene encoder AVC, devuelve el fallback. */
export async function exportMP4(p: Params, log: (s: string) => void, fps = 30): Promise<{ ok: boolean; data?: ArrayBuffer; frames?: number; error?: string }> {
  const fallback = "este navegador no tiene encoder H.264 en WebCodecs. Guardá el json y corré: npm run render -- presets/tu-preset.json";
  if (typeof (window as any).VideoEncoder === "undefined") return { ok: false, error: fallback };
  const config: VideoEncoderConfig = { codec: "avc1.640028", width: W, height: H, bitrate: 12_000_000, framerate: fps };
  try { const s = await VideoEncoder.isConfigSupported(config); if (!s.supported) return { ok: false, error: fallback }; }
  catch { return { ok: false, error: fallback }; }
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: "avc", width: W, height: H }, fastStart: "in-memory" });
  const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => log(String(e)) });
  enc.configure(config);
  const r = new Renderer(); r.set(p);
  const cv = new OffscreenCanvas(W, H); const ctx = cv.getContext("2d")!;
  const n = Math.round(r.loopSeconds() * fps);
  for (let i = 0; i < n; i++) {
    r.render(ctx, i / fps);
    const f = new VideoFrame(cv, { timestamp: Math.round((i * 1e6) / fps) });
    enc.encode(f, { keyFrame: i % 60 === 0 }); f.close();
    if (i % 30 === 0) { log(`mp4 ${i}/${n}`); await new Promise(res => setTimeout(res, 0)); }
  }
  await enc.flush(); muxer.finalize();
  return { ok: true, data: muxer.target.buffer, frames: n };
}
