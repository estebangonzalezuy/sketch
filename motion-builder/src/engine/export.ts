import { FileSystemWritableFileStreamTarget, Muxer } from 'mp4-muxer';
import { Zip, ZipPassThrough } from 'fflate';
import type { Project } from '../core/project';
import type { ToolDefinition } from '../core/tool';
import type { AssetLibrary } from './assets';
import { Engine } from './renderFrame';

/**
 * Export frame a frame por renderFrame, a escala 1, con un motor propio: la preview no se entera.
 * Escribe por stream al archivo: a 4K nada se acumula en memoria.
 */
export type ExportOptions = {
  format: 'mp4' | 'png';
  bitrateMbps: number;
  background: string; // H.264 no tiene alfa: el MP4 se compone sobre este color
  signal: AbortSignal;
  onProgress: (done: number, total: number) => void;
};

export class CancelledError extends Error {
  constructor() {
    super('Export cancelado');
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

const checkCancel = (signal: AbortSignal) => {
  if (signal.aborted) throw new CancelledError();
};

async function pickCodec(width: number, height: number, bitrate: number, framerate: number) {
  if (typeof VideoEncoder === 'undefined') throw new Error('WebCodecs no está disponible en este navegador. Usá Chrome.');
  // H.264: el nivel depende del tamaño (4K necesita nivel 5.1). High → Main → Baseline.
  const candidates = width * height > 1920 * 1088 ? ['avc1.640033', 'avc1.640034', 'avc1.4d0033', 'avc1.42e033'] : ['avc1.640028', 'avc1.640033', 'avc1.4d0028', 'avc1.42003e'];
  for (const codec of candidates) {
    if ((await VideoEncoder.isConfigSupported({ codec, width, height, bitrate, framerate })).supported) return codec;
  }
  throw new Error('El navegador no puede codificar H.264 a esta resolución.');
}

async function exportMP4(engine: Engine, project: Project, file: FileSystemWritableFileStream, o: ExportOptions) {
  const { width, height, fps, durationFrames: frames } = project;
  if (width % 2 || height % 2) throw new Error('H.264 necesita ancho y alto pares.');
  const bitrate = o.bitrateMbps * 1e6;
  const codec = await pickCodec(width, height, bitrate, fps);

  const muxer = new Muxer({
    target: new FileSystemWritableFileStreamTarget(file),
    video: { codec: 'avc', width, height, frameRate: fps },
    fastStart: false, // el índice va al final: no hace falta tener el archivo en memoria
  });

  let encodeError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (encodeError = e),
  });
  encoder.configure({ codec, width, height, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'avc' } });

  try {
    engine.background = o.background;
    const frameDuration = 1e6 / fps;
    for (let i = 0; i < frames; i++) {
      checkCancel(o.signal);
      await engine.renderFrame(project, i, 1);
      const frame = new VideoFrame(engine.renderer.domElement, { timestamp: Math.round(i * frameDuration), duration: Math.round(frameDuration) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      // Backpressure: no llenar la cola del encoder.
      while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2));
      if (encodeError) throw encodeError;
      o.onProgress(i + 1, frames);
      await tick(); // deja respirar a la UI
    }
    await encoder.flush();
    if (encodeError) throw encodeError;
    muxer.finalize();
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }
}

const canvasToPNG = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob falló'))), 'image/png'));

/** Secuencia PNG con alfa en un .zip, sin recomprimir: los PNG ya están comprimidos. */
async function exportPNG(engine: Engine, project: Project, file: FileSystemWritableFileStream, o: ExportOptions) {
  const frames = project.durationFrames;
  let failure: Error | null = null;
  let writes = Promise.resolve();
  const zip = new Zip((err, data) => {
    if (err) failure = err;
    else writes = writes.then(() => file.write(data as BufferSource));
  });
  const digits = String(frames).length;
  for (let i = 0; i < frames; i++) {
    checkCancel(o.signal);
    await engine.renderFrame(project, i, 1);
    const png = new Uint8Array(await (await canvasToPNG(engine.renderer.domElement)).arrayBuffer());
    const entry = new ZipPassThrough(`frame_${String(i).padStart(digits, '0')}.png`);
    zip.add(entry);
    entry.push(png, true);
    await writes; // backpressure: el disco marca el ritmo
    if (failure) throw failure;
    o.onProgress(i + 1, frames);
  }
  zip.end();
  await writes;
}

export async function exportProject(project: Project, tools: readonly ToolDefinition[], assets: AssetLibrary, file: FileSystemWritableFileStream, options: ExportOptions) {
  const engine = new Engine(document.createElement('canvas'), tools, assets);
  try {
    if (options.format === 'mp4') await exportMP4(engine, project, file, options);
    else await exportPNG(engine, project, file, options);
    await file.close();
  } catch (e) {
    await file.abort().catch(() => {}); // el archivo a medio escribir se descarta
    throw e;
  } finally {
    engine.dispose();
  }
}
