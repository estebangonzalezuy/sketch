// Secuencia: cada media en orden, las fotos duran `hold`, los videos su duración (máx. 30 s).
// La transición ocupa los últimos `fade` segundos de cada media y mezcla con la siguiente
// (la última vuelve a la primera, así el loop no salta).

export const MAX_VIDEO_SECONDS = 30;

export interface Clip {
  /** Duración propia: hold para fotos, duración del video (recortada) para videos. */
  duration: number;
}

export interface TimelineSample {
  /** Índice de la media que se ve (A). */
  a: number;
  /** Índice de la siguiente (B), o -1 si no hay transición en curso. */
  b: number;
  /** Tiempo local dentro de A. */
  localA: number;
  /** Tiempo local dentro de B (cuando hay transición). */
  localB: number;
  /** 0..1, avance de la transición A → B. */
  fade: number;
}

export function clipDuration(kind: 'image' | 'video', hold: number, videoDuration = 0): number {
  if (kind === 'image') return Math.max(0.1, hold);
  return Math.max(0.1, Math.min(MAX_VIDEO_SECONDS, videoDuration || hold));
}

export function totalDuration(clips: Clip[]): number {
  return clips.reduce((s, c) => s + c.duration, 0);
}

export function sampleTimeline(clips: Clip[], t: number, fade: number): TimelineSample {
  const n = clips.length;
  if (n === 0) return { a: -1, b: -1, localA: 0, localB: 0, fade: 0 };
  const total = totalDuration(clips);
  let time = ((t % total) + total) % total;
  let i = 0;
  while (i < n - 1 && time >= clips[i].duration) {
    time -= clips[i].duration;
    i++;
  }
  const d = clips[i].duration;
  const local = Math.min(time, d);
  // Con una sola media no hay transición. La fade nunca ocupa más de la mitad del clip.
  const f = n > 1 ? Math.min(Math.max(0, fade), d * 0.5, clips[(i + 1) % n].duration * 0.5) : 0;
  if (f > 0 && local > d - f) {
    const into = local - (d - f);
    return { a: i, b: (i + 1) % n, localA: local, localB: into, fade: into / f };
  }
  return { a: i, b: -1, localA: local, localB: 0, fade: 0 };
}
