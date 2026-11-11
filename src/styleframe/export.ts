import {
  BufferTarget,
  CanvasSource,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  QUALITY_VERY_HIGH,
  WebMOutputFormat,
  type VideoCodec,
} from 'mediabunny';

export type FrameRenderer = (ctx: CanvasRenderingContext2D, t: number) => void;
export type Container = 'mp4' | 'webm';

export type VideoJob = {
  width: number;
  height: number;
  fps: number;
  duration: number;
  render: FrameRenderer;
  container: Container;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
};

export function frameCount(duration: number, fps: number) {
  return Math.max(1, Math.round(duration * fps));
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d', { alpha: false })! };
}

export function renderStill(width: number, height: number, render: FrameRenderer, t: number) {
  const { canvas, ctx } = makeCanvas(width, height);
  render(ctx, t);
  return canvas;
}

export function exportPNG(width: number, height: number, render: FrameRenderer, t: number) {
  const canvas = renderStill(width, height, render, t);
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG encode failed'))), 'image/png'),
  );
}

/**
 * Offline, frame-by-frame encode through WebCodecs: frame i is always rendered at exactly i / fps,
 * so the same parameters always give the same video, independent of machine speed.
 * Falls back to real-time MediaRecorder capture where WebCodecs can't encode.
 */
export async function exportVideo(job: VideoJob): Promise<{ blob: Blob; codec: string }> {
  const { width, height, fps, duration, render, container, onProgress, signal } = job;
  const format =
    container === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat();
  const preferred: VideoCodec[] =
    container === 'mp4' ? ['avc', 'hevc', 'vp9', 'av1'] : ['vp9', 'vp8', 'av1'];
  const supported = format.getSupportedVideoCodecs();
  const codec =
    typeof VideoEncoder === 'undefined'
      ? null
      : await getFirstEncodableVideoCodec(
          preferred.filter((c) => supported.includes(c)),
          { width, height },
        );
  if (!codec) return recordRealtime(job);

  const { canvas, ctx } = makeCanvas(width, height);
  const output = new Output({ format, target: new BufferTarget() });
  const source = new CanvasSource(canvas, {
    codec,
    quality: QUALITY_VERY_HIGH,
    keyFrameInterval: 1,
  });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();
  const n = frameCount(duration, fps);
  for (let i = 0; i < n; i++) {
    if (signal?.aborted) {
      await output.cancel();
      throw new DOMException('Export cancelled', 'AbortError');
    }
    render(ctx, i / fps);
    await source.add(i / fps, 1 / fps);
    onProgress?.((i + 1) / n);
  }
  await output.finalize();
  const buffer = (output.target as BufferTarget).buffer!;
  return { blob: new Blob([buffer], { type: format.mimeType }), codec };
}

async function recordRealtime(job: VideoJob): Promise<{ blob: Blob; codec: string }> {
  const { width, height, fps, duration, render, onProgress, signal } = job;
  const { canvas, ctx } = makeCanvas(width, height);
  render(ctx, 0);
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const mime = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find((m) =>
    MediaRecorder.isTypeSupported(m),
  );
  if (!mime) throw new Error('This browser cannot encode video.');
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 16_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => (rec.onstop = () => res()));
  rec.start();
  const n = frameCount(duration, fps);
  const t0 = performance.now();
  for (let i = 0; i < n && !signal?.aborted; i++) {
    render(ctx, i / fps);
    track.requestFrame();
    onProgress?.((i + 1) / n);
    const wait = t0 + ((i + 1) * 1000) / fps - performance.now();
    await new Promise((r) => setTimeout(r, Math.max(0, wait)));
  }
  rec.stop();
  await done;
  if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), codec: `${mime} (real-time)` };
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
