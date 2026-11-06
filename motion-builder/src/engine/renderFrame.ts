import * as THREE from 'three';
import { evaluate, layerIntegral, type EvaluatedLayer, type ToolSpecs } from '../core/evaluate';
import type { Layer, Project } from '../core/project';
import type { Params, RenderContext, ToolDefinition, ToolInstance } from '../core/tool';
import { AssetLibrary, AssetTextures } from './assets';
import { Compositor } from './compositor';
import { renderOrder } from './graph';
import { Blitter, createRenderer } from './renderer';
import { TargetPool } from './targets';

type Live = { toolId: string; instance: ToolInstance; prepared: string | null };

/** Un WebGLRenderer compartido y una instancia de tool por capa. Scrub, playback y export pasan por acá. */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  private definitions: Map<string, ToolDefinition>;
  private specs: ToolSpecs;
  private pool = new TargetPool();
  private blitter = new Blitter();
  private compositor = new Compositor();
  private live = new Map<string, Live>();
  private frameTargets = new Map<string, THREE.WebGLRenderTarget>();
  private output: THREE.WebGLRenderTarget | null = null;
  private assetTextures = new AssetTextures();
  background: string | null = null; // color sólido detrás del canvas, para salidas sin alfa

  constructor(canvas: HTMLCanvasElement, tools: readonly ToolDefinition[], private assets = new AssetLibrary()) {
    this.renderer = createRenderer(canvas);
    this.definitions = new Map(tools.map((t) => [t.id, t]));
    this.specs = Object.fromEntries(tools.map((t) => [t.id, t.params]));
  }

  async renderFrame(project: Project, frame: number, scale = 1) {
    const width = Math.max(1, Math.round(project.width * scale));
    const height = Math.max(1, Math.round(project.height * scale));
    this.renderer.setSize(width, height, false);
    this.releaseFrame();

    const evaluated = new Map(evaluate(project, frame, this.specs).map((e) => [e.layer.id, e]));
    const order = renderOrder(project.layers).filter((l) => evaluated.has(l.id));
    this.syncInstances(project);

    const jobs = order.map((layer) => {
      const entry = evaluated.get(layer.id)!;
      const target = this.pool.acquire(width, height);
      this.frameTargets.set(layer.id, target);
      return { layer, entry, ctx: this.context(project, entry, target, width, height) };
    });

    for (const { layer, entry, ctx } of jobs) await this.prepare(layer, entry.params, ctx);

    // Sin await desde acá: ningún otro frame se puede intercalar a mitad de render.
    for (const { layer, entry, ctx } of jobs) {
      for (const [id, input] of Object.entries(layer.inputs)) ctx.inputs[id] = this.resolveInput(input, width, height);
      this.renderer.setRenderTarget(ctx.target);
      this.renderer.setClearColor(0x000000, 0); // el fondo de color de una escena 3D deja su color cargado
      this.renderer.clear();
      this.live.get(layer.id)!.instance.render(entry.params, ctx);
      this.applyFraming(layer.id, entry, ctx.target);
    }

    this.composite(project, evaluated, width, height);
    this.renderer.setRenderTarget(null);
  }

  /** El encuadre va antes de componer: una capa que usa esta como entrada recibe lo mismo que se ve. */
  private applyFraming(id: string, entry: EvaluatedLayer, target: THREE.WebGLRenderTarget) {
    const { zoom, center } = entry;
    if (zoom === 1 && center[0] === 0.5 && center[1] === 0.5) return;
    const framed = this.pool.acquire(target.width, target.height);
    this.compositor.frame(this.renderer, target, framed, zoom, center);
    this.pool.release(target);
    this.frameTargets.set(id, framed);
  }

  /** Un clip inactivo no entrega salida, y una imagen que falta tampoco: las tools toleran null. */
  private resolveInput(input: Layer['inputs'][string], width: number, height: number) {
    if (!input) return null;
    if ('layerId' in input) return this.frameTargets.get(input.layerId)?.texture ?? null;
    const bitmap = this.assets.bitmap(input.assetId);
    return bitmap ? this.assetTextures.get(input.assetId, bitmap, width, height) : null;
  }

  /** Píxeles RGBA del resultado, o de una capa del último frame. Para tests y captura. */
  readPixels(layerId?: string) {
    const target = layerId ? this.frameTargets.get(layerId) : this.output;
    if (!target) throw new Error(`No hay píxeles de ${layerId ?? 'salida'}`);
    const pixels = new Uint8Array(target.width * target.height * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
    return pixels;
  }

  dispose() {
    this.releaseFrame();
    this.live.forEach((l) => l.instance.dispose());
    this.live.clear();
    this.pool.dispose();
    this.blitter.dispose();
    this.compositor.dispose();
    this.assetTextures.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // los contextos son limitados: Chrome tira primero el más viejo, que sería la preview
  }

  private syncInstances(project: Project) {
    for (const [id, live] of this.live) {
      const layer = project.layers.find((l) => l.id === id);
      if (layer?.toolId === live.toolId) continue;
      live.instance.dispose();
      this.live.delete(id);
    }
    for (const layer of project.layers) {
      if (this.live.has(layer.id)) continue;
      const tool = this.definitions.get(layer.toolId);
      if (!tool) throw new Error(`La capa "${layer.name}" usa una tool desconocida: ${layer.toolId}`);
      this.live.set(layer.id, { toolId: tool.id, instance: tool.create(), prepared: null });
    }
  }

  /** prepare corre la primera vez y cuando cambia un parámetro que no es de frame. */
  private async prepare(layer: Layer, params: Params, ctx: RenderContext) {
    const live = this.live.get(layer.id)!;
    const specs = this.specs[layer.toolId];
    const key = JSON.stringify(Object.keys(specs).filter((id) => specs[id].animate !== 'frame').map((id) => params[id]));
    if (key === live.prepared) return;
    await live.instance.prepare?.(params, ctx);
    live.prepared = key;
  }

  private context(project: Project, entry: EvaluatedLayer, target: THREE.WebGLRenderTarget, width: number, height: number): RenderContext {
    const { layer, frame, loop } = entry;
    const specs = this.specs[layer.toolId];
    return {
      renderer: this.renderer,
      target,
      width,
      height,
      aspect: project.width / project.height,
      unit: Math.min(width, height) / 1080,
      frame,
      fps: project.fps,
      time: frame / project.fps,
      durationFrames: layer.durationFrames,
      seed: layer.seed,
      loop,
      inputs: {},
      integral: (paramId) => layerIntegral(layer, specs, paramId, frame, project.fps),
      blit: (texture) => this.blitter.draw(this.renderer, texture, target),
    };
  }

  /** Compone de abajo hacia arriba: en el proyecto, el índice 0 es la capa superior. */
  private composite(project: Project, evaluated: Map<string, EvaluatedLayer>, width: number, height: number) {
    let accumulated = this.pool.acquire(width, height);
    this.renderer.setRenderTarget(accumulated);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();

    for (const layer of [...project.layers].reverse()) {
      const entry = evaluated.get(layer.id);
      if (!entry || !layer.visible || entry.opacity <= 0) continue;
      const next = this.pool.acquire(width, height);
      this.compositor.draw(this.renderer, this.frameTargets.get(layer.id)!, accumulated, next, entry.opacity, layer.blend);
      this.pool.release(accumulated);
      accumulated = next;
    }

    this.blitter.draw(this.renderer, accumulated.texture, null, this.background);
    this.output = accumulated;
  }

  private releaseFrame() {
    this.frameTargets.forEach((t) => this.pool.release(t));
    this.frameTargets.clear();
    if (this.output) this.pool.release(this.output);
    this.output = null;
  }
}
