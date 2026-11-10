import { defineTool, type Params, type RenderContext } from '../../core/tool';
import { readColour, readPaint, sprayParams } from './params';
import { SprayPipeline } from './pipeline';
import { SmearField } from './smear';

// Spray: el efecto de foto del entorno Spray. Toma una capa o imagen y la pasa a un aerógrafo
// granulado que hierve, en las 2 tintas del par. "morph a" es una segunda fuente: el parámetro morph
// la mezcla por manchas de ruido, no como un crossfade. "texto" es otra capa (por ejemplo Texto) cuyo
// alfa entra al mismo efecto, así el type queda pulverizado como esténcil.

export default defineTool({
  id: 'spray',
  name: 'Spray',
  version: 1,
  kind: 'effect',
  inputs: [
    { id: 'source', label: 'Fuente', required: true },
    { id: 'morph', label: 'Morph a', required: false },
    { id: 'type', label: 'Texto', required: false },
  ],
  params: {
    morph: { kind: 'number', default: 0, min: 0, max: 1, step: 0.001, label: 'morph', animate: 'frame', group: 'Spray' },
    textEffect: { kind: 'number', default: 0.5, min: 0, max: 1, step: 0.01, label: 'efecto en el texto', animate: 'frame', group: 'Spray' },
    ...sprayParams({ pair: 'ink/white' }),
  },
  presets: {
    Spray: { style: 'spray', airbrush: 4, grain: 22, boil: 1 },
    Riso: { style: 'riso', airbrush: 2.5, grain: 18 },
    Stipple: { style: 'stipple', airbrush: 2, matrix: 'blue noise', cell: 2 },
    Puntos: { style: 'puntos', airbrush: 3, grain: 20 },
  },
  animations: {
    'Morph por manchas': { tracks: { morph: [[0.15, 0, 'inOut'], [0.85, 1]] } },
    'Enfoca': { tracks: { airbrush: [[0, 10, 'out'], [0.6, 2]] } },
    'Hervor que se calma': { tracks: { boil: [[0, 3, 'out'], [0.7, 0.3]], grain: [[0, 40, 'out'], [0.7, 18]] } },
    'Onda': { tracks: { wave: [[0, 0, 'inOut'], [0.5, 0.7, 'inOut'], [1, 0]] } },
  },
  create() {
    const pipeline = new SprayPipeline();
    const smear = new SmearField();
    return {
      render(p: Params, ctx: RenderContext) {
        const a = ctx.inputs.source ?? null;
        if (!a) return; // sin entrada queda transparente, como Pixelado
        const hasField = smear.advance(ctx.renderer, pipeline.quadRef, p.strokes as string, ctx.frame, ctx.fps, p.brush as number, p.spring as number, ctx.width, ctx.height);
        pipeline.renderPhoto(ctx, {
          a,
          b: ctx.inputs.morph ?? null,
          morph: p.morph as number,
          type: ctx.inputs.type ?? null,
          textEffect: p.textEffect as number,
          field: hasField ? smear.texture : null,
          paint: readPaint(p),
          colour: readColour(p),
        });
        ctx.renderer.setRenderTarget(ctx.target);
      },
      dispose() {
        pipeline.dispose();
        smear.dispose();
      },
    };
  },
});
