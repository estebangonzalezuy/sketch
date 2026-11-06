import * as THREE from 'three';
import { defineTool, type Params, type RenderContext } from '../../core/tool';
import animations from './animations';
import { WordAtlas } from './atlas';
import { DemoSource } from './demoSource';
import { buildLayout, LayoutTexture, stepWarp, type MotionState, type StepEase } from './layout';
import { MosaicPass } from './mosaic';
import presets from './presets.json';

const DEFAULT_WORDS = [
  'LUZ', 'SOMBRA', 'RITMO', 'MOTION', 'SEÑAL', 'RUIDO', 'FORMA', 'ECO', 'PULSO', 'CUERPO',
  'MIRADA', 'TIEMPO', 'ROSTRO', 'GRANO', 'TRAMA', 'VOZ', 'CAPA', 'BORDE', 'FRECUENCIA', 'MATERIA',
  'IMAGEN', 'TEXTO', 'DISTANCIA', 'FUEGO', 'AIRE', 'MAPA', 'CÓDIGO', 'MEMORIA', 'VÉRTIGO', 'NOCHE',
  'GESTO', 'PIEL', 'SUPERFICIE', 'LÍNEA', 'ONDA', 'MOSAICO',
];

const DEMO_PERIOD = 10; // segundos del movimiento secundario de la demo, sin loop

export default defineTool({
  id: 'tag-shader',
  name: 'Tag Shader',
  version: 1,
  kind: 'hybrid',
  presets,
  animations,
  inputs: [{ id: 'source', label: 'Fuente', required: false }],
  params: {
    // Vista
    zoom: { kind: 'number', default: 1, min: 1, max: 24, interp: 'log', animate: 'frame', group: 'Vista' },
    center: { kind: 'vec2', default: [0.5, 0.5], min: 0, max: 1, animate: 'frame', group: 'Vista' },

    // Estilo
    mix: { kind: 'number', default: 0, min: 0, max: 1, step: 0.001, label: 'texto ↔ marcas', animate: 'frame', group: 'Estilo' },
    wipe: { kind: 'number', default: 0.35, min: 0, max: 1, step: 0.01, label: 'aleatorio ↔ barrido', animate: 'frame', group: 'Estilo' },
    density: { kind: 'number', default: 1, min: 0, max: 1, step: 0.001, animate: 'frame', group: 'Estilo' },

    // Marcas
    cell: { kind: 'number', default: 1.6, min: 0.4, max: 6, step: 0.01, animate: 'frame', group: 'Marcas' },
    line: { kind: 'number', default: 0.16, min: 0.02, max: 1, step: 0.01, animate: 'frame', group: 'Marcas' },
    dot: { kind: 'number', default: 0.22, min: 0.02, max: 1, step: 0.01, animate: 'frame', group: 'Marcas' },
    gap: { kind: 'number', default: 0.06, min: 0, max: 0.8, step: 0.01, animate: 'frame', group: 'Marcas' },
    blockH: { kind: 'number', default: 0.9, min: 0.1, max: 1, step: 0.01, animate: 'frame', group: 'Marcas' },
    t0: { kind: 'number', default: 0.12, min: 0, max: 1, step: 0.01, animate: 'frame', group: 'Marcas' },
    t1: { kind: 'number', default: 0.4, min: 0, max: 1, step: 0.01, animate: 'frame', group: 'Marcas' },
    t2: { kind: 'number', default: 0.97, min: 0, max: 1, step: 0.01, animate: 'frame', group: 'Marcas' },
    snap: { kind: 'boolean', default: true, animate: 'frame', group: 'Marcas' },

    // Palabras
    words: { kind: 'text', default: DEFAULT_WORDS.join('\n'), multiline: true, animate: 'rebuild', group: 'Palabras' },
    family: { kind: 'select', default: 'KMR Apparat', options: ['KMR Apparat', 'Geist Mono', 'Archivo Narrow'], animate: 'none', group: 'Palabras' },
    weight: { kind: 'number', default: 400, min: 300, max: 800, step: 100, animate: 'none', group: 'Palabras' },
    italic: { kind: 'boolean', default: false, animate: 'none', group: 'Palabras' },
    capHeight: { kind: 'number', default: 0.62, min: 0.3, max: 0.95, step: 0.01, animate: 'rebuild', group: 'Palabras' },
    padding: { kind: 'number', default: 0.28, min: 0, max: 1.5, step: 0.01, animate: 'rebuild', group: 'Palabras' },

    // Paleta
    tones: { kind: 'select', default: '2', options: ['2', '3'], animate: 'frame', group: 'Paleta' },
    c0: { kind: 'color', default: '#0000FF', animate: 'frame', group: 'Paleta' },
    c1: { kind: 'color', default: '#8080FF', animate: 'frame', group: 'Paleta' },
    c2: { kind: 'color', default: '#FFFFFF', animate: 'frame', group: 'Paleta' },
    colorMode: { kind: 'select', default: 'palette', options: ['palette', 'source'], animate: 'frame', group: 'Paleta' },

    // Luminancia
    contrast: { kind: 'number', default: 1.6, min: 0.2, max: 4, step: 0.01, animate: 'frame', group: 'Luminancia' },
    brightness: { kind: 'number', default: 0, min: -0.5, max: 0.5, step: 0.01, animate: 'frame', group: 'Luminancia' },
    threshold1: { kind: 'number', default: 0.42, min: 0, max: 1, step: 0.01, animate: 'frame', group: 'Luminancia' },
    threshold2: { kind: 'number', default: 0.68, min: 0, max: 1, step: 0.01, animate: 'frame', group: 'Luminancia' },
    invert: { kind: 'boolean', default: false, animate: 'frame', group: 'Luminancia' },
    sampling: { kind: 'select', default: 'center', options: ['center', 'average'], animate: 'frame', group: 'Luminancia' },

    // Layout
    rowHeight: { kind: 'number', default: 22, min: 8, max: 120, step: 1, animate: 'rebuild', group: 'Layout' },
    widthVariation: { kind: 'number', default: 0.55, min: 0, max: 1, step: 0.01, animate: 'rebuild', group: 'Layout' },

    // Movimiento: velocidades en ciclos por segundo
    speed: { kind: 'number', default: 0.1, min: 0, max: 2, step: 0.001, integrated: true, animate: 'frame', group: 'Movimiento' },
    speedVariety: { kind: 'number', default: 0.6, min: 0, max: 1, step: 0.01, animate: 'rebuild', group: 'Movimiento' },
    maxMult: { kind: 'number', default: 3, min: 1, max: 8, step: 1, animate: 'rebuild', group: 'Movimiento' },
    stretch: { kind: 'number', default: 0.7, min: 0, max: 1, step: 0.01, animate: 'frame', group: 'Movimiento' },
    stretchRate: { kind: 'number', default: 0.1, min: 0, max: 1, step: 0.001, integrated: true, animate: 'frame', group: 'Movimiento' },
    advance: { kind: 'select', default: 'continuo', options: ['continuo', 'pasos'], animate: 'frame', group: 'Movimiento' },
    steps: { kind: 'number', default: 4, min: 1, max: 32, step: 1, label: 'pasos por ciclo', animate: 'frame', group: 'Movimiento' },
    stepHold: { kind: 'number', default: 0.5, min: 0, max: 0.95, step: 0.01, animate: 'frame', group: 'Movimiento' },
    stepEase: { kind: 'select', default: 'easeInOut', options: ['linear', 'easeIn', 'easeOut', 'easeInOut', 'expo'], animate: 'frame', group: 'Movimiento' },
    stagger: { kind: 'number', default: 0, min: 0, max: 1, step: 0.01, label: 'desfase en pasos', animate: 'frame', group: 'Movimiento' },
    staggerOrder: { kind: 'select', default: 'cascada', options: ['cascada', 'aleatorio'], animate: 'frame', group: 'Movimiento' },
    direction: { kind: 'select', default: 'aleatoria', options: ['aleatoria', 'alternada', 'izquierda', 'derecha'], animate: 'frame', group: 'Movimiento' },

    // Fuente demo, cuando no hay entrada
    demoTurns: { kind: 'number', default: 0.1, min: 0, max: 1, step: 0.001, integrated: true, label: 'vueltas por segundo', animate: 'frame', group: 'Fuente' },
  },
  create() {
    const atlas = new WordAtlas();
    const layout = new LayoutTexture();
    const mosaic = new MosaicPass();
    const demo = new DemoSource();
    mosaic.u.uAtlas.value = atlas.texture;
    mosaic.u.uLayout.value = layout.texture;

    let atlasKey = '';
    let atlasBuilds = 0;
    let layoutKey = '';

    /** El layout vive en unidades de fila y usa el aspect del proyecto: es el mismo en toda escala. */
    function syncLayout(p: Params, ctx: RenderContext) {
      const key = [atlasBuilds, p.rowHeight, ctx.aspect, p.padding, p.widthVariation, p.speedVariety, p.maxMult, ctx.seed].join('|');
      if (key === layoutKey) return;
      layoutKey = key;
      const rowHeight = p.rowHeight as number;
      const rows = Math.ceil((1080 * Math.max(1, 1 / ctx.aspect)) / rowHeight);
      const rowLen = (1080 * Math.max(1, ctx.aspect)) / rowHeight;
      const base = buildLayout({
        rows,
        rowLen,
        widths: atlas.widths,
        pad: p.padding as number,
        variation: p.widthVariation as number,
        speedVariety: p.speedVariety as number,
        maxMult: p.maxMult as number,
        seed: ctx.seed,
      });
      if (layout.setRows(base, rowLen)) mosaic.u.uLayout.value = layout.texture;
      mosaic.u.uRows.value = rows;
      mosaic.u.uRowLen.value = rowLen;
      mosaic.u.uPad.value = p.padding;
    }

    function motion(p: Params, ctx: RenderContext): MotionState {
      const stepped = p.advance === 'pasos';
      const steps = Math.max(1, Math.round(p.steps as number));
      return {
        travel: ctx.integral('speed'),
        stretchTravel: ctx.integral('stretchRate'),
        stretch: p.stretch as number,
        warp: stepped ? stepWarp(steps, p.stepHold as number, p.stepEase as StepEase) : (x) => x,
        stagger: stepped ? (p.stagger as number) / steps : 0,
        staggerRandom: p.staggerOrder === 'aleatorio',
        direction: p.direction as MotionState['direction'],
      };
    }

    function bindSource(ctx: RenderContext) {
      const input = ctx.inputs.source ?? null;
      if (input) {
        mosaic.u.uSource.value = input;
        mosaic.u.uSourceLinear.value = false; // las salidas de capa ya vienen codificadas
        return;
      }
      demo.setAspect(ctx.aspect);
      demo.update(ctx.integral('demoTurns'), ctx.loop ? ctx.loop.phase : (ctx.time / DEMO_PERIOD) % 1);
      demo.render(ctx.renderer);
      mosaic.u.uSource.value = demo.rt.texture;
      mosaic.u.uSourceLinear.value = true;
    }

    return {
      async prepare(p: Params, ctx: RenderContext) {
        const font = { family: p.family as string, weight: p.weight as number, italic: p.italic as boolean, capHeight: p.capHeight as number };
        const words = String(p.words).split('\n');
        const key = JSON.stringify([words, font]);
        if (key === atlasKey) return;
        atlas.maxTextureSize = ctx.renderer.capabilities.maxTextureSize;
        await atlas.build(words, font);
        mosaic.u.uAtlasSize.value.set(atlas.canvas.width, atlas.canvas.height);
        atlasKey = key;
        atlasBuilds++;
      },
      render(p: Params, ctx: RenderContext) {
        syncLayout(p, ctx);
        layout.update(motion(p, ctx));
        bindSource(ctx);

        const u = mosaic.u;
        const zoom = Math.min(24, Math.max(1, p.zoom as number));
        const half = 0.5 / zoom; // la ventana de zoom queda dentro del poster
        const [cx, cy] = p.center as [number, number];
        u.uZoom.value = zoom;
        u.uCenter.value.set(Math.min(1 - half, Math.max(half, cx)), Math.min(1 - half, Math.max(half, cy)));
        u.uResolution.value.set(ctx.width, ctx.height);
        u.uRowHeight.value = (p.rowHeight as number) * ctx.unit;
        mosaic.setPalette({ tones: Number(p.tones) as 2 | 3, c0: p.c0 as string, c1: p.c1 as string, c2: p.c2 as string });
        u.uT1.value = p.threshold1;
        u.uT2.value = Math.max(p.threshold2 as number, p.threshold1 as number);
        u.uContrast.value = p.contrast;
        u.uBrightness.value = p.brightness;
        u.uInvert.value = p.invert;
        u.uSampling.value = p.sampling === 'center' ? 0 : 1;
        u.uColorMode.value = p.colorMode === 'palette' ? 0 : 1;
        u.uDensity.value = p.density;
        u.uMix.value = p.mix;
        u.uWipe.value = p.wipe;
        u.uCellW.value = Math.max(p.cell as number, 0.2);
        u.uMarkT.value.set(p.t0, Math.max(p.t1 as number, p.t0 as number), Math.max(p.t2 as number, p.t1 as number, p.t0 as number));
        u.uLine.value = p.line;
        u.uDot.value = p.dot;
        u.uGap.value = p.gap;
        u.uBlockH.value = p.blockH;
        u.uSnap.value = p.snap;

        ctx.renderer.setRenderTarget(ctx.target);
        ctx.renderer.render(mosaic.scene, mosaic.camera);
      },
      dispose() {
        atlas.texture.dispose();
        layout.texture.dispose();
        mosaic.material.dispose();
        (mosaic.scene.children[0] as THREE.Mesh).geometry.dispose();
        demo.dispose();
      },
    };
  },
});
