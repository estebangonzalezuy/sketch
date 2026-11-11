// Export del builder. Camino 1: WebCodecs + mp4-muxer, en la app.
// Camino 2 (fallback, obligatorio): scripts/render.mjs (Chrome headless + ffmpeg).
import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { FPS } from "./env";
import type { Runtime } from "./runtime";

const CODECS = ["avc1.640028", "avc1.4d0028", "avc1.640033", "avc1.4d0033", "avc1.42001f"];

export async function pickCodec(width: number, height: number): Promise<string | null> {
  if (typeof VideoEncoder === "undefined") return null;
  for (const codec of CODECS) {
    try {
      const r = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate: 16e6, framerate: FPS });
      if (r.supported) return codec;
    } catch {
      /* siguiente */
    }
  }
  return null;
}

export interface ExportOptions {
  seconds?: number;
  signal?: AbortSignal;
  onProgress?: (f: number) => void;
}

/**
 * RGBA → I420 en rango TV (16–235 / 16–240), matriz BT.709. Se lo damos ya convertido al encoder
 * para que no elija rango completo (yuvj420p), que es lo que hace el Chrome headless con un VideoFrame RGB.
 */
function rgbaToI420(src: Uint8ClampedArray, w: number, h: number, out: Uint8Array) {
  const ySize = w * h;
  const cw = w >> 1;
  const ch = h >> 1;
  const U = ySize;
  const V = ySize + cw * ch;
  for (let i = 0, p = 0; i < ySize; i++, p += 4) {
    out[i] = 16 + ((219 * (0.2126 * src[p] + 0.7152 * src[p + 1] + 0.0722 * src[p + 2])) / 255 + 0.5) | 0;
  }
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const p = ((y * 2 + dy) * w + x * 2 + dx) * 4;
          r += src[p];
          g += src[p + 1];
          b += src[p + 2];
        }
      r /= 1020;
      g /= 1020;
      b /= 1020;
      const yn = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      out[U + y * cw + x] = Math.min(240, Math.max(16, Math.round(128 + (224 * (b - yn)) / 1.8556)));
      out[V + y * cw + x] = Math.min(240, Math.max(16, Math.round(128 + (224 * (r - yn)) / 1.5748)));
    }
  }
}

/** Rango que reportó el encoder (decoderConfig.colorSpace) en el último export. */
export let lastRange: "tv" | "pc" | "desconocido" = "desconocido";

/** reset → render(t = i/30) por frame → I420 rango TV → VideoEncoder → mp4-muxer. */
export async function encodeMp4(rt: Runtime, opts: ExportOptions = {}): Promise<Uint8Array> {
  const { width, height } = rt.ctx;
  const codec = await pickCodec(width, height);
  if (!codec) throw new Error("este navegador no tiene encoder H.264 (WebCodecs): usá npm run render");
  const seconds = opts.seconds ?? rt.timeline.duration;
  const total = Math.round(seconds * FPS);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height, frameRate: FPS },
    fastStart: "in-memory",
  });
  let failure: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const cs = meta?.decoderConfig?.colorSpace;
      if (cs && cs.fullRange !== undefined && cs.fullRange !== null) lastRange = cs.fullRange ? "pc" : "tv";
      muxer.addVideoChunk(chunk, meta);
    },
    error: (e) => (failure = e as Error),
  });
  encoder.configure({
    codec,
    width,
    height,
    bitrate: 16e6,
    framerate: FPS,
    avc: { format: "avc" },
  });

  const g = rt.out.getContext("2d")!;
  const yuv = new Uint8Array(width * height + 2 * (width >> 1) * (height >> 1));
  const colorSpace: VideoColorSpaceInit = { primaries: "bt709", transfer: "bt709", matrix: "bt709", fullRange: false };
  lastRange = "desconocido";

  for (let i = 0; i < total; i++) {
    if (opts.signal?.aborted) {
      encoder.close();
      throw new DOMException("cancelado", "AbortError");
    }
    if (failure) throw failure;
    rt.renderAt(i / FPS);
    rgbaToI420(g.getImageData(0, 0, width, height).data, width, height, yuv);
    const frame = new VideoFrame(yuv, {
      format: "I420",
      codedWidth: width,
      codedHeight: height,
      timestamp: Math.round((i * 1e6) / FPS),
      duration: Math.round(1e6 / FPS),
      colorSpace,
    });
    encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
    frame.close();
    while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 0));
    opts.onProgress?.((i + 1) / total);
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0)); // deja respirar a la UI
  }
  await encoder.flush();
  if (failure) throw failure;
  encoder.close();
  muxer.finalize();
  return new Uint8Array(muxer.target.buffer);
}

export function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob vacío"))), "image/png"));
}

export function download(data: Blob | Uint8Array, name: string, type = "application/octet-stream") {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export function fileName(rt: Runtime, ext: string) {
  const s = rt.state;
  return `${s.envId}-${s.seed}-${s.fmt}.${ext}`;
}
