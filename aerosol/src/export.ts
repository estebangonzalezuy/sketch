import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

export interface ExportJob {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  fps: number;
  frames: number;
  /** Dibuja el frame i en el canvas. */
  renderFrame: (i: number) => Promise<void>;
  onProgress: (done: number, total: number) => void;
  signal: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  ext: 'mp4' | 'webm';
}

const AVC_CODECS = ['avc1.640033', 'avc1.640028', 'avc1.4d0028', 'avc1.42002a', 'avc1.42001f'];

async function pickCodec(width: number, height: number, bitrate: number, fps: number): Promise<VideoEncoderConfig | null> {
  for (const codec of AVC_CODECS) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate, framerate: fps, avc: { format: 'avc' } };
    try {
      const r = await VideoEncoder.isConfigSupported(config);
      if (r.supported) return config;
    } catch {
      // siguiente
    }
  }
  return null;
}

export async function exportVideo(job: ExportJob): Promise<ExportResult> {
  const bitrate = Math.min(job.width, job.height) >= 1000 ? 14_000_000 : 7_000_000;
  if ('VideoEncoder' in window) {
    const config = await pickCodec(job.width, job.height, bitrate, job.fps);
    if (config) return encodeMp4(job, config);
  }
  return recordWebm(job, bitrate);
}

async function encodeMp4(job: ExportJob, config: VideoEncoderConfig): Promise<ExportResult> {
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: job.width, height: job.height, frameRate: job.fps },
    fastStart: 'in-memory',
  });
  let failure: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      failure = e instanceof Error ? e : new Error(String(e));
    },
  });
  encoder.configure(config);
  const us = 1e6 / job.fps;
  try {
    for (let i = 0; i < job.frames; i++) {
      if (job.signal.aborted) throw new DOMException('Export cancelado', 'AbortError');
      if (failure) throw failure;
      await job.renderFrame(i);
      const frame = new VideoFrame(job.canvas, { timestamp: Math.round(i * us), duration: Math.round(us) });
      encoder.encode(frame, { keyFrame: i % (job.fps * 2) === 0 });
      frame.close();
      job.onProgress(i + 1, job.frames);
      while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2));
      // Cede el hilo de vez en cuando para que la barra se actualice.
      if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
    }
    await encoder.flush();
    if (failure) throw failure;
    muxer.finalize();
    return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), ext: 'mp4' };
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }
}

/** Fallback sin WebCodecs: MediaRecorder graba en tiempo real, así que se dibuja a 30 fps reales. */
async function recordWebm(job: ExportJob, bitrate: number): Promise<ExportResult> {
  const stream = job.canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start();
  const t0 = performance.now();
  try {
    for (let i = 0; i < job.frames; i++) {
      if (job.signal.aborted) throw new DOMException('Export cancelado', 'AbortError');
      await job.renderFrame(i);
      track.requestFrame();
      job.onProgress(i + 1, job.frames);
      const wait = t0 + ((i + 1) * 1000) / job.fps - performance.now();
      await new Promise((r) => setTimeout(r, Math.max(0, wait)));
    }
  } finally {
    rec.stop();
    await stopped;
    track.stop();
  }
  return { blob: new Blob(chunks, { type: 'video/webm' }), ext: 'webm' };
}

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
