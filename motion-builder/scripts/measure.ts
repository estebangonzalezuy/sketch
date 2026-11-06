import { chromium } from 'playwright-core';
import { createServer } from 'vite';

/** Tiempo por frame de cada tool y de todas juntas, esperando a la GPU con una lectura de píxeles. */
const server = await createServer({ server: { port: 5195 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const page = await browser.newPage();
page.setDefaultTimeout(180_000);
page.setDefaultNavigationTimeout(40_000);
await page.goto('http://localhost:5195/?harness');
await page.waitForFunction(() => 'mb' in window);

declare const mb: any;

const rows = await page.evaluate(async () => {
  const { makeLayer, makeProject } = mb.demo;
  const textLayer = () => makeLayer('texto', 'text', { params: { text: { value: 'MOTION' }, size: { value: 280 }, align: { value: 'center' } } });
  const tagLayer = () => makeLayer('tag', 'tag-shader');
  const asciiLayer = (fontSize: number) => makeLayer('ascii', 'ascii', { blend: 'screen', inputs: { source: { layerId: 'fuente' } }, params: { fontSize: { value: fontSize }, showPattern: { value: true } } });
  const source = () => makeLayer('fuente', 'tag-shader', { visible: false });
  const extruderLayer = () => makeLayer('extruder', 'text-extruder', { blend: 'screen', params: { text: { value: 'MOTION' }, family: { value: 'Geist Mono' }, weight: { value: 'Bold' }, anim: { value: 'wave' }, floor: { value: false } } });
  const out = [];
  const sets: [string, any[]][] = [['Texto', [textLayer()]], ['Tag Shader', [tagLayer()]], ['Text Extruder', [extruderLayer()]], ['ASCII fontSize 10', [asciiLayer(10), source()]], ['ASCII fontSize 6', [asciiLayer(6), source()]], ['Las cuatro', [textLayer(), asciiLayer(10), extruderLayer(), tagLayer(), source()]]];
  for (const [name, layers] of sets) {
    for (const [label, width, height] of [['1080p', 1920, 1080], ['4K', 3840, 2160]] as const) {
      const project = makeProject(layers, { width, height });
      const e = mb.engine();
      await e.render(project, 0, 1);
      const n = 12;
      const t0 = performance.now();
      for (let f = 1; f <= n; f++) {
        await e.engine.renderFrame(project, f * 5, 1);
        const gl = e.engine.renderer.getContext();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); // espera a la GPU
      }
      out.push(`${name} ${label}: ${((performance.now() - t0) / n).toFixed(1)} ms por frame`);
      e.engine.dispose();
    }
  }
  return out;
});
console.log(rows.join('\n'));
await browser.close();
await server.close();
process.exit(0);
