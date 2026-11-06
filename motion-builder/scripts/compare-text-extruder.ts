import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer, type Plugin } from 'vite';

/**
 * Compara Text Extruder contra el original con los mismos parámetros.
 * Uso: npx vite-node scripts/compare-text-extruder.ts <copia del original> <carpeta de salida>
 * Debe ser una copia: Vite escribe su caché dentro de la carpeta que sirve.
 */
const [originalDir, outDir] = process.argv.slice(2).map((p) => resolve(p));
mkdirSync(outDir, { recursive: true });

const exposeHooks: Plugin = {
  name: 'expose-hooks',
  transform: (code, id) => (id.endsWith('/src/main.ts') ? code.replace('Object.assign(window, { cfg, build, textRoot });', 'Object.assign(window, { cfg, build, textRoot, renderer, scene, camera, applyMaterials, canvas, frame, placeOnFloor });') : code),
};

const original = await createServer({ root: originalDir, configFile: false, plugins: [exposeHooks], server: { port: 5192 }, logLevel: 'error' });
const ours = await createServer({ server: { port: 5193 }, logLevel: 'error' });
await original.listen();
await ours.listen();
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });

declare const mb: any;

const cases: { name: string; config: Record<string, unknown>; params: Record<string, unknown> }[] = [
  { name: 'clay', config: {}, params: {} },
  { name: 'chrome', config: { text: 'TAG\nSHADER', face: '#F2F4F7', side: '#CFD3DA', roughness: 0.04, metalness: 1, look: 'chrome' }, params: { text: 'TAG\nSHADER', face: '#F2F4F7', side: '#CFD3DA', roughness: 0.04, metalness: 1, look: 'chrome' } },
  { name: 'plastico-arco', config: { text: 'LOOP', arc: 60, face: '#3A5BFF', side: '#2340C9', roughness: 0.4, look: 'plastic', floor: false }, params: { text: 'LOOP', arc: 60, face: '#3A5BFF', side: '#2340C9', roughness: 0.4, look: 'plastic', floor: false } },
];

const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultTimeout(60_000);
await page.goto('http://localhost:5192/');
await page.waitForFunction(() => 'cfg' in window);
const ourPage = await browser.newPage();
ourPage.setDefaultTimeout(60_000);
await ourPage.goto('http://localhost:5193/?harness');
await ourPage.waitForFunction(() => 'mb' in window);

for (const c of cases) {
  const ref = await page.evaluate(async (c) => {
    const w = window as any;
    w.baseline ??= structuredClone(w.cfg);
    Object.assign(w.cfg, w.baseline, c.config);
    await w.build();
    w.placeOnFloor();
    w.applyMaterials();
    w.frame();
    await new Promise((r) => setTimeout(r, 300)); // que termine el damping de OrbitControls
    w.renderer.render(w.scene, w.camera);
    return { url: w.canvas.toDataURL('image/png'), width: w.canvas.width, height: w.canvas.height };
  }, c);

  const result = await ourPage.evaluate(
    async ({ c, ref }) => {
      const { makeLayer, makeProject } = mb.demo;
      const params = Object.fromEntries(Object.entries({ background: true, ...c.params }).map(([id, value]) => [id, { value }]));
      const project = makeProject([makeLayer('te', 'text-extruder', { params })], { width: ref.width, height: ref.height });
      const e = mb.engine();
      await e.render(project, 0, 1);
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
      const [a, b] = [await load(png), await load(ref.url)];
      let sum = 0;
      let max = 0;
      let over8 = 0;
      for (let i = 0; i < a.data.length; i += 4) {
        const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
        sum += d;
        if (d > 8) over8++;
        if (d > max) max = d;
      }
      e.engine.dispose();
      return { png, mean: sum / (a.data.length / 4), max, over8: (100 * over8) / (a.data.length / 4), width: a.width, height: a.height };
    },
    { c, ref },
  );
  const save = (name: string, url: string) => writeFileSync(join(outDir, name), Buffer.from(url.split(',')[1], 'base64'));
  save(`${c.name}.original.png`, ref.url);
  save(`${c.name}.motion-builder.png`, result.png);
  console.log(`${c.name} ${result.width}×${result.height}: delta medio ${result.mean.toFixed(2)}, máximo ${result.max}, ${result.over8.toFixed(2)} % de píxeles con delta mayor a 8`);
}

await browser.close();
await original.close();
await ours.close();
process.exit(0);
