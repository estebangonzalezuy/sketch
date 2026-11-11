import type { PathPoint, Project, Track } from "../types";

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Median-filter a path to kill single-frame center jitter (YOLO boxes). */
export function smoothPath(path: PathPoint[], win = 5): PathPoint[] {
  if (path.length < 3) return path;
  const half = Math.floor(win / 2);
  return path.map((p, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(path.length, i + half + 1);
    const neigh = path.slice(lo, hi).filter((q) => Math.abs(q.f - p.f) <= half + 1);
    const out: PathPoint = {
      ...p,
      x: Math.round(median(neigh.map((q) => q.x)) * 10) / 10,
      y: Math.round(median(neigh.map((q) => q.y)) * 10) / 10,
    };
    if (p.x1 !== undefined) {
      out.x1 = Math.round(median(neigh.map((q) => q.x1 ?? q.x)));
      out.y1 = Math.round(median(neigh.map((q) => q.y1 ?? q.y)));
      out.x2 = Math.round(median(neigh.map((q) => q.x2 ?? q.x)));
      out.y2 = Math.round(median(neigh.map((q) => q.y2 ?? q.y)));
    }
    return out;
  });
}


const cache = new Map<string, Project>();

export function indexTrack(t: Track): Track {
  t.path = smoothPath(t.path);
  const byFrame = new Map<number, PathPoint>();
  for (const p of t.path) byFrame.set(p.f, p);
  t.byFrame = byFrame;
  return t;
}

export async function loadProject(name: string): Promise<Project> {
  const hit = cache.get(name);
  if (hit) return hit;
  const res = await fetch(`/tracks/${name}.json`);
  if (!res.ok) throw new Error(`no se pudo cargar tracks/${name}.json`);
  const data = (await res.json()) as Project;
  data.tracks = data.tracks.map(indexTrack);
  cache.set(name, data);
  return data;
}

export function atFrame(track: Track, f: number): PathPoint | null {
  const map = track.byFrame;
  if (!map) return null;
  if (map.has(f)) return map.get(f)!;
  if (f < track.born || f > track.dead) return null;
  // nearest previous, then interpolate if we have a next
  let prev: PathPoint | null = null;
  let next: PathPoint | null = null;
  for (const p of track.path) {
    if (p.f <= f) prev = p;
    if (p.f >= f && !next) next = p;
  }
  if (prev && next && prev !== next) {
    const a = (f - prev.f) / (next.f - prev.f);
    return {
      f,
      x: prev.x + (next.x - prev.x) * a,
      y: prev.y + (next.y - prev.y) * a,
    };
  }
  return prev ?? next;
}

export function pathUntil(track: Track, f: number): PathPoint[] {
  return track.path.filter((p) => p.f <= f);
}

export function inFrame(p: { x: number; y: number }, w = 1080, h = 1350, margin = -20) {
  return p.x > -margin && p.x < w + margin && p.y > -margin && p.y < h + margin;
}
