import { buildPath, colors, indexAt, recipe, type Params, type Path } from "./harmono";

export const W = 1080, H = 1350;

/** Un solo módulo de dibujo para preview y export: misma secuencia de trazos => mismo resultado. */
export class Renderer {
  p!: Params; path!: Path;
  paper: HTMLCanvasElement | OffscreenCanvas;
  pctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  last = -1;
  constructor() {
    this.paper = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(W, H) : Object.assign(document.createElement("canvas"), { width: W, height: H });
    this.pctx = this.paper.getContext("2d") as any;
  }
  set(p: Params) { this.p = structuredClone(p); this.path = buildPath(this.p, W, H); this.last = -1; }
  loopSeconds() { return this.p.drawSeconds + this.p.holdSeconds; }
  clearPaper() { const c = colors(this.p); this.pctx.fillStyle = c.bg; this.pctx.fillRect(0, 0, W, H); this.last = 0; }

  /** time = segundos dentro del loop. */
  render(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, time: number) {
    const p = this.p, path = this.path, c = colors(p);
    const u = time / p.drawSeconds;
    const idx = indexAt(path, u, p.timeMode);
    if (this.last < 0 || idx < this.last) this.clearPaper();
    if (idx > this.last) {
      const g = this.pctx;
      g.strokeStyle = c.fg; g.lineWidth = p.penWidth; g.lineJoin = "round"; g.lineCap = "round";
      g.beginPath(); g.moveTo(path.xs[this.last], path.ys[this.last]);
      for (let i = this.last + 1; i <= idx; i++) g.lineTo(path.xs[i], path.ys[i]);
      g.stroke();
      this.last = idx;
    }
    ctx.drawImage(this.paper as any, 0, 0);
    // pluma: un punto sólido mientras dibuja
    if (u < 1) {
      ctx.fillStyle = c.fg; ctx.beginPath();
      ctx.arc(path.xs[idx], path.ys[idx], Math.max(3, p.penWidth * 2.5), 0, Math.PI * 2); ctx.fill();
    }
    if (p.caption) this.caption(ctx, Math.min(u, 1), idx);
  }

  caption(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, u: number, idx: number) {
    const p = this.p, c = colors(p), path = this.path;
    ctx.fillStyle = c.fg; ctx.textBaseline = "alphabetic";
    const y1 = H - 78, y2 = H - 44;
    ctx.font = "500 34px 'Archivo Narrow'"; ctx.textAlign = "left";
    ctx.fillText(p.name, 48, y1);
    ctx.textAlign = "right";
    ctx.fillText(`t ${path.ts[idx].toFixed(1)} / ${path.tStop.toFixed(1)}`, W - 48, y1);
    ctx.font = "400 19px 'Archivo Narrow'"; ctx.textAlign = "left";
    const r = recipe(p); ctx.fillText(r.length > 150 ? r.slice(0, 150) + "…" : r, 48, y2);
    // regla de progreso: hairline
    ctx.fillRect(48, H - 28, (W - 96) * u, 1);
  }
}
