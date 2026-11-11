import { Muxer, ArrayBufferTarget } from "mp4-muxer";

const CODECS = ["avc1.640028", "avc1.4D0028", "avc1.42E028", "avc1.42001f"];

export async function pickAvc(w: number, h: number): Promise<string | null> {
  if (typeof VideoEncoder === "undefined") return null;
  for (const codec of CODECS) {
    try {
      const r = await VideoEncoder.isConfigSupported({ codec, width: w, height: h, bitrate: 12_000_000, framerate: 30 });
      if (r.supported) return codec;
    } catch { /* sigue */ }
  }
  return null;
}

/** H.264 + MP4 con WebCodecs. Si no hay encoder AVC, tira error (fallback: npm run demo → ffmpeg). */
export async function exportMp4(canvas: HTMLCanvasElement, nFrames: number, fps: number,
  draw: (i: number) => void, onProgress: (i: number) => void): Promise<Blob> {
  const codec = await pickAvc(canvas.width, canvas.height);
  if (!codec) throw new Error("Este navegador no tiene encoder H.264 en WebCodecs. Usá `npm run demo` (cuadro a cuadro + ffmpeg).");
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: "avc", width: canvas.width, height: canvas.height }, fastStart: "in-memory" });
  let err: unknown = null;
  const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { err = e; } });
  enc.configure({ codec, width: canvas.width, height: canvas.height, bitrate: 12_000_000, framerate: fps, avc: { format: "avc" } });
  for (let i = 0; i < nFrames; i++) {
    draw(i);
    const f = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
    enc.encode(f, { keyFrame: i % 60 === 0 });
    f.close();
    if (enc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0));
    onProgress(i + 1);
    if (err) throw err;
  }
  await enc.flush();
  muxer.finalize();
  return new Blob([target.buffer], { type: "video/mp4" });
}
