import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer, type Plugin } from 'vite';

/**
 * Compara Tag Shader contra el original, píxel a píxel, con los mismos parámetros.
 * Uso: npx vite-node scripts/compare-tag-shader.ts <copia del original> <carpeta de salida>
 * Debe ser una copia: Vite escribe su caché dentro de la carpeta que sirve.
 */
const [originalDir, outDir] = process.argv.slice(2).map((p) => resolve(p));
mkdirSync(outDir, { recursive: true });

// El original expone menos de lo que hace falta en su objeto de debug. Se agrega al servirlo, sin tocar archivos.
const exposeHooks: Plugin = {
  name: 'expose-hooks',
  transform: (code, id) =>
    id.endsWith('/src/main.ts') ? code.replace('tagShader: { config, renderAt, source }', 'tagShader: { config, renderAt, source, setRenderScale, applyPalette }') : code,
};

const original = await createServer({ root: originalDir, configFile: false, plugins: [exposeHooks], server: { port: 5183 }, logLevel: 'error' });
const ours = await createServer({ server: { port: 5182 }, logLevel: 'error' });
await original.listen();
await ours.listen();
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });

declare const mb: any;
declare const tagShader: any;

const cases = [
  { name: 'texto', phase: 0.4, config: {}, params: {} },
  { name: 'marcas', phase: 0.25, config: { style: 'Marcas' }, params: { mix: 1 } },
  { name: 'tres-tonos-zoom', phase: 0.7, config: { view: { mode: 'Wall', zoom: 5, centerX: 0.42, centerY: 0.56 }, palette: { tones: 3, c0: '#000000', c1: '#17C4C4', c2: '#FFFFFF' } }, params: { zoom: 5, center: [0.42, 0.56], tones: '3', c0: '#000000', c1: '#17C4C4', c2: '#FFFFFF' } },
  { name: 'mezcla-density', phase: 0.55, config: { transition: { mode: 'manual', value: 0.5 }, density: { value: 0.3 } }, params: { mix: 0.5, density: 0.3 } },
];

const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://localhost:5183/');
await page.waitForFunction(() => 'tagShader' in window);
await page.waitForTimeout(1500); // atlas y arranque del original
const ourPage = await browser.newPage();
await ourPage.goto('http://localhost:5182/?harness');
await ourPage.waitForFunction(() => 'mb' in window);

for (const scale of [1, 2]) {
  for (const c of cases) {
    const ref = await page.evaluate(
      ({ c, scale }) => {
        const { config, renderAt, setRenderScale, applyPalette } = tagShader;
        const w = window as any;
        w.baseline ??= structuredClone(config);
        for (const k of Object.keys(w.baseline)) config[k] = structuredClone(w.baseline[k]);
        config.motion.playing = false;
        config.view.mode = 'Poster';
        for (const [k, v] of Object.entries(c.config)) {
          if (typeof v === 'object') Object.assign(config[k], v);
          else config[k] = v;
        }
        applyPalette();
        setRenderScale(scale === 2 ? 1 : 0.5);
        // Mismo tick que el render: el loop del original no alcanza a redibujar.
        renderAt(c.phase);
        return (document.getElementById('view') as HTMLCanvasElement).toDataURL('image/png');
      },
      { c, scale },
    );

    const result = await ourPage.evaluate(
      async ({ c, ref, scale }) => {
        const { makeLayer, makeProject } = mb.demo;
        const params = Object.fromEntries(Object.entries(c.params).map(([id, value]) => [id, { value }]));
        const frame = Math.round(c.phase * 300);
        const project = makeProject([makeLayer('tag', 'tag-shader', { loopFrames: 300, params })], { width: 1920 * scale, height: 1080 * scale });
        const e = mb.engine();
        await e.render(project, frame, 1);
        const png = e.png();
        const load = async (url: string) => {
          const img = new Image();
          img.src = url;
          await img.decode();
          const canvas = new OffscreenCanvas(img.width, img.height);
          const g = canvas.getContext('2d', { willReadFrequently: true })!;
          g.drawImage(img, 0, 0);
          return g.getImageData(0, 0, img.width, img.height);
        };
        const [a, b] = [await load(png), await load(ref)];
        if (a.width !== b.width || a.height !== b.height) throw new Error(`tamaños: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
        let different = 0;
        let maxDelta = 0;
        for (let i = 0; i < a.data.length; i += 4) {
          const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
          if (d > 0) different++;
          if (d > maxDelta) maxDelta = d;
        }
        e.engine.dispose();
        return { png, width: a.width, height: a.height, different, total: a.data.length / 4, maxDelta };
      },
      { c, ref, scale },
    );

    const save = (name: string, url: string) => writeFileSync(join(outDir, name), Buffer.from(url.split(',')[1], 'base64'));
    if (scale === 1) {
      save(`${c.name}.original.png`, ref);
      save(`${c.name}.motion-builder.png`, result.png);
    }
    console.log(`${c.name} ${result.width}×${result.height}: ${result.different} de ${result.total} píxeles distintos, delta máximo ${result.maxDelta}`);
  }
}

await browser.close();
await original.close();
await ours.close();
process.exit(0);
