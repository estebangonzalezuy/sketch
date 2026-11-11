import type { Palette } from "../palettes";
import type { Dials, ModeId, Project, ViewId } from "../types";
import { appearK, bestSegment, isMoving, pickPerBucket, rankByScore, schedule, sizeScale } from "../engine/dials";
import { atFrame, inFrame, pathUntil } from "../engine/project";
import {
  drawCota,
  drawDot,
  drawSwatchTag,
  drawTag,
  drawTrail,
  fillBackground,
} from "../engine/draw";

export type RenderArgs = {
  ctx: CanvasRenderingContext2D;
  project: Project;
  mode: ModeId;
  view: ViewId;
  palette: Palette;
  dials: Dials;
  frame: number;
  time: number;
};

const BUCKET_ORDER = ["personas", "autos", "taxis", "colectivos", "bicis", "motos"];

export function renderMode(args: RenderArgs) {
  switch (args.mode) {
    case "trayectorias":
      return renderTrayectorias(args);
    case "medidas":
      return renderMedidas(args);
    case "contador":
      return renderContador(args);
    case "atlas":
      return renderAtlas(args);
  }
}

function renderTrayectorias({ ctx, project, view, palette, dials, frame, time }: RenderArgs) {
  const moving = project.tracks
    .filter((t) => isMoving(t))
    .map((t) => ({ t, seg: bestSegment(t.path)! }))
    .sort((a, b) => b.seg.len - a.seg.len)
    .map((x) => x.t);
  // Cap so the drawing stays readable; cantidad scales within that cap.
  const cap = 24;
  const pool = moving.slice(0, cap);
  const scheduled = schedule(pool, dials, project.fps, 2);
  const sw = sizeScale(dials.tamaño);
  const lineW = (view === "canvas" ? 4 : 3) * (0.7 + 0.6 * dials.tamaño);
  const color = view === "canvas" ? palette.mark : palette.fg;
  const ring = view === "canvas" ? palette.canvas : palette.bg;

  for (const tr of scheduled) {
    if (time < tr.appearAt) continue;
    const { alpha } = appearK(time, tr.appearAt);
    const pts = pathUntil(tr, frame);
    const seg = bestSegment(pts);
    if (!seg) continue;
    drawTrail(ctx, seg.pts, color, lineW, alpha);
    const head = seg.pts[seg.pts.length - 1];
    drawDot(ctx, head.x, head.y, color, ring, 6 * sw, alpha);
  }
}

function formatMeters(px: number, pxPerM: number): string {
  const m = px / pxPerM;
  const v = Math.round(m * 10) / 10;
  const s = v.toFixed(1).replace(".", ",");
  return `${s} m`;
}

function formatKmh(pxPerFrame: number, pxPerM: number, fps: number): string {
  const mps = (pxPerFrame * fps) / pxPerM;
  const kmh = mps * 3.6;
  const v = Math.round(kmh);
  return `${v} km/h`;
}

function renderMedidas({ ctx, project, palette, dials, frame, time }: RenderArgs) {
  const measures = project.measures ?? [];
  const byId = new Map(project.tracks.map((t) => [String(t.id), t]));
  const pxPerM = project.pxPerM ?? 140;
  const ranked = measures.map((m, i) => ({
    ...m,
    born: Math.round((m.appear ?? 0) * project.fps),
    _i: i,
  }));
  const scheduled = schedule(ranked, dials, project.fps, 1);
  const sc = sizeScale(dials.tamaño);
  const line = palette.fg;
  const boxBg = palette.bg;
  const boxFg = palette.fg;

  for (const m of scheduled) {
    if (time < m.appearAt) continue;
    const { alpha, scale } = appearK(time, m.appearAt);
    if (m.kind === "distance" && m.b) {
      const ta = byId.get(m.a);
      const tb = byId.get(m.b);
      if (!ta || !tb) continue;
      const pa = atFrame(ta, frame);
      const pb = atFrame(tb, frame);
      if (!pa || !pb || !inFrame(pa) || !inFrame(pb)) continue;
      const d = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      drawCota(ctx, pa, pb, formatMeters(d, pxPerM), line, boxBg, boxFg, sc * scale, alpha);
    } else if (m.kind === "speed") {
      const ta = byId.get(m.a);
      if (!ta) continue;
      const win = m.window ?? 8;
      const pNow = atFrame(ta, frame);
      const pPrev = atFrame(ta, Math.max(ta.born, frame - win));
      if (!pNow || !pPrev || !inFrame(pNow, 1080, 1350, 10)) continue;
      const hx = pNow.x - pPrev.x;
      const hy = pNow.y - pPrev.y;
      const n = Math.hypot(hx, hy) || 1;
      const ux = hx / n;
      const uy = hy / n;
      const p1 = { x: pNow.x - ux * 70, y: pNow.y - uy * 70 };
      const p2 = { x: pNow.x + ux * 90, y: pNow.y + uy * 90 };
      const pxPerFrame = Math.hypot(hx, hy) / win;
      drawCota(ctx, p1, p2, formatKmh(pxPerFrame, pxPerM, project.fps), line, boxBg, boxFg, sc * scale, alpha);
    }
  }
}

function renderContador({ ctx, project, view, palette, dials, frame, time }: RenderArgs) {
  const usable = project.tracks.filter((t) => t.bucket);
  const ranked = pickPerBucket(usable, dials.cantidad);
  // cantidad already applied per class; schedule with cantidad=1 so we don't cut twice
  const scheduled = schedule(ranked, { ...dials, cantidad: 1 }, project.fps, 1);
  // Totals accumulate over the cantidad-selected universe as soon as the
  // object is born in the footage — not when a stagger happens to reach it.
  const universe = scheduled;
  const sw = sizeScale(dials.tamaño);
  const fill = palette.fg;
  const ring = view === "canvas" ? palette.canvas : palette.bg;

  const counts: Record<string, number> = {};
  for (const k of BUCKET_ORDER) counts[k] = 0;
  for (const t of universe) {
    if (!t.bucket) continue;
    if (t.born <= frame) counts[t.bucket] += 1;
  }

  for (const t of universe) {
    if (time < t.appearAt) continue;
    const p = atFrame(t, frame);
    if (!p || !inFrame(p)) continue;
    if (frame < t.born || frame > t.dead) continue;
    const { alpha } = appearK(time, t.appearAt);
    drawDot(ctx, p.x, p.y, fill, ring, 6 * sw, alpha);
  }

  let y = 40;
  for (const k of BUCKET_ORDER) {
    const n = counts[k] ?? 0;
    if (n === 0 && (k === "bicis" || k === "motos" || k === "colectivos")) continue;
    const label = `${String(n).padStart(2, "0")}  ${k}`;
    const fade = Math.min(1, time / 0.4);
    const tag = drawTag(
      ctx,
      { x: 40, y: y + 20 },
      "",
      label,
      palette.bg,
      palette.fg,
      {
        scale: sw,
        alpha: fade,
        offset: { x: 0, y: -20 },
        drawLeader: false,
        drawDot: false,
        rightSize: 44,
      },
    );
    y += tag.h + 10;
  }
}

const ATLAS_OFFSET: Record<string, { x: number; y: number }> = {
  reja: { x: -170, y: 30 },
  planta: { x: 36, y: -76 },
  bandera: { x: 36, y: -80 },
  piedra: { x: 48, y: 56 },
  muro: { x: 28, y: 48 },
  cielo: { x: -30, y: 56 },
};

function atlasOffset(id: string, i: number): { x: number; y: number } {
  return ATLAS_OFFSET[id] ?? [{ x: 30, y: 50 }, { x: 40, y: -70 }, { x: 30, y: -80 }, { x: 48, y: 50 }][i % 4];
}

function renderAtlas({ ctx, project, view, palette, dials, frame, time }: RenderArgs) {
  const withColor = project.tracks.filter((t) => t.swatch);
  const ranked = [...withColor]; // keep authored order
  const scheduled = schedule(ranked, dials, project.fps, 1);
  const sc = sizeScale(dials.tamaño);
  const fg = view === "canvas" ? palette.mark : palette.fg;
  const bg = view === "canvas" ? palette.canvas : palette.bg;
  // In footage, chrome is ink/white (or current palette). Swatch chip is sampled color.
  // Use palette fg/bg for the box; on footage prefer the palette as selected.
  const boxFg = palette.fg;
  const boxBg = palette.bg;
  const leader = view === "canvas" ? palette.mark : palette.fg;

  scheduled.forEach((t, i) => {
    if (time < t.appearAt) return;
    const p = atFrame(t, frame);
    if (!p || !inFrame(p)) return;
    if (frame < t.born) return;
    const { alpha, scale } = appearK(time, t.appearAt);
    const sw = t.swatch!;
    drawSwatchTag(ctx, p, t.label, sw.hex, sw.rgb, boxFg, boxBg, {
      scale: sc * scale,
      alpha,
      offset: atlasOffset(String(t.id), i),
      leader,
    });
    // silence unused
    void fg;
    void bg;
  });
}

export function clearScene(
  ctx: CanvasRenderingContext2D,
  view: ViewId,
  palette: Palette,
  video: HTMLVideoElement,
) {
  if (view === "canvas") {
    fillBackground(ctx, palette.canvas);
  } else {
    if (video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, 1080, 1350);
    } else {
      fillBackground(ctx, "#111111");
    }
  }
}
