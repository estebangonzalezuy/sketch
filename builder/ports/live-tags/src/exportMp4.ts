import { Muxer, ArrayBufferTarget } from "mp4-muxer";

export type ExportProgress = (frame: number, total: number) => void;

function pickCodec(): string | null {
  if (typeof VideoEncoder === "undefined") return null;
  const candidates = [
    "avc1.42001f", // baseline 4.2? actually 3.1 often written avc1.42E01E
    "avc1.42E01E",
    "avc1.4D001F",
    "avc1.64001F",
  ];
  for (const codec of candidates) {
    try {
      // isConfigSupported is async; we try configure later. Prefer mid-tier.
      void codec;
    } catch {
      /* ignore */
    }
  }
  return candidates[0];
}

export async function canEncodeAvc(): Promise<boolean> {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") return false;
  try {
    const r = await VideoEncoder.isConfigSupported({
      codec: "avc1.42001f",
      width: 1080,
      height: 1350,
      bitrate: 8_000_000,
      framerate: 30,
      avc: { format: "avc" },
    });
    return !!r.supported;
  } catch {
    return false;
  }
}

export async function exportMp4(opts: {
  canvas: HTMLCanvasElement;
  fps: number;
  nFrames: number;
  draw: (frame: number) => Promise<void> | void;
  onProgress?: ExportProgress;
}): Promise<Blob> {
  const ok = await canEncodeAvc();
  if (!ok) {
    throw new Error("WebCodecs AVC no está disponible en este browser");
  }
  const codec = pickCodec()!;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width: opts.canvas.width, height: opts.canvas.height },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      throw e;
    },
  });
  encoder.configure({
    codec,
    width: opts.canvas.width,
    height: opts.canvas.height,
    bitrate: 8_000_000,
    framerate: opts.fps,
    avc: { format: "avc" },
    hardwareAcceleration: "prefer-software",
  });

  for (let i = 0; i < opts.nFrames; i++) {
    await opts.draw(i);
    opts.onProgress?.(i + 1, opts.nFrames);
    const frame = new VideoFrame(opts.canvas, {
      timestamp: Math.round((i * 1_000_000) / opts.fps),
      duration: Math.round(1_000_000 / opts.fps),
    });
    encoder.encode(frame, { keyFrame: i % opts.fps === 0 });
    frame.close();
    // yield so the UI can paint progress
    if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  await encoder.flush();
  muxer.finalize();
  return new Blob([target.buffer], { type: "video/mp4" });
}

/** Fallback: record the already-drawn canvas as WebM (not used for the official export). */
export async function recordWebm(canvas: HTMLCanvasElement, ms: number): Promise<Blob> {
  const stream = canvas.captureStream(30);
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.start(100);
  await new Promise((r) => setTimeout(r, ms));
  rec.stop();
  await new Promise((r) => {
    rec.onstop = () => r(null);
  });
  return new Blob(chunks, { type: "video/webm" });
}
