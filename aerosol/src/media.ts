import { MAX_VIDEO_SECONDS } from './timeline';

export type MediaSource = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

export interface MediaItem {
  id: number;
  name: string;
  kind: 'image' | 'video';
  el: MediaSource;
  width: number;
  height: number;
  /** Duración del video (recortada a 30 s). 0 para fotos. */
  videoDuration: number;
  thumb: string;
  url?: string;
  tex: WebGLTexture | null;
  uploaded: boolean;
}

let nextId = 1;

function thumbOf(el: MediaSource, w: number, h: number): string {
  const c = document.createElement('canvas');
  c.width = 72;
  c.height = 72;
  const ctx = c.getContext('2d')!;
  const s = Math.max(72 / w, 72 / h);
  ctx.drawImage(el, (72 - w * s) / 2, (72 - h * s) / 2, w * s, h * s);
  return c.toDataURL('image/jpeg', 0.8);
}

export function fromCanvas(name: string, c: HTMLCanvasElement): MediaItem {
  return {
    id: nextId++,
    name,
    kind: 'image',
    el: c,
    width: c.width,
    height: c.height,
    videoDuration: 0,
    thumb: thumbOf(c, c.width, c.height),
    tex: null,
    uploaded: false,
  };
}

export async function fromFile(file: File): Promise<MediaItem> {
  const url = URL.createObjectURL(file);
  if (file.type.startsWith('video/')) {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    v.src = url;
    await new Promise<void>((resolve, reject) => {
      v.addEventListener('loadeddata', () => resolve(), { once: true });
      v.addEventListener('error', () => reject(new Error(`No se pudo abrir ${file.name}`)), { once: true });
    });
    return {
      id: nextId++,
      name: file.name,
      kind: 'video',
      el: v,
      width: v.videoWidth,
      height: v.videoHeight,
      videoDuration: Math.min(MAX_VIDEO_SECONDS, isFinite(v.duration) ? v.duration : MAX_VIDEO_SECONDS),
      thumb: thumbOf(v, v.videoWidth, v.videoHeight),
      url,
      tex: null,
      uploaded: false,
    };
  }
  const img = new Image();
  img.src = url;
  await img.decode();
  return {
    id: nextId++,
    name: file.name,
    kind: 'image',
    el: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    videoDuration: 0,
    thumb: thumbOf(img, img.naturalWidth, img.naturalHeight),
    url,
    tex: null,
    uploaded: false,
  };
}

/** Colores de todas las medias, reducidos, para armar la paleta "Photo". */
export function sampleColors(items: MediaItem[], size = 40): Float32Array {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const out = new Float32Array(items.length * size * size * 3);
  items.forEach((it, k) => {
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(it.el, 0, 0, size, size);
    const d = ctx.getImageData(0, 0, size, size).data;
    for (let i = 0; i < size * size; i++) {
      out[(k * size * size + i) * 3] = d[i * 4] / 255;
      out[(k * size * size + i) * 3 + 1] = d[i * 4 + 1] / 255;
      out[(k * size * size + i) * 3 + 2] = d[i * 4 + 2] / 255;
    }
  });
  return out;
}

export function seekVideo(v: HTMLVideoElement, t: number): Promise<void> {
  const target = Math.min(Math.max(0, t), Math.max(0, v.duration - 0.05));
  if (Math.abs(v.currentTime - target) < 1e-3 && v.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    v.addEventListener('seeked', done, { once: true });
    v.currentTime = target;
  });
}
