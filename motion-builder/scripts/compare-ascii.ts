import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

/**
 * Compara ASCII contra el componente original, montado con un Framer simulado.
 * En modo color con un solo carácter el texto no varía, así que se comparan los píxeles.
 * Uso: npx vite-node scripts/compare-ascii.ts <carpeta de salida>
 */
const outDir = resolve(process.argv[2]);
mkdirSync(outDir, { recursive: true });

const server = await createServer({ resolve: { alias: { framer: resolve('tests/fixtures/framerStub.ts') } }, server: { port: 5196 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });

declare const mb: any;

const makeImage = () => {
  const c = document.createElement('canvas');
  c.width = 1280;
  c.height = 720;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 1280, 720);
  sky.addColorStop(0, '#FF3B94');
  sky.addColorStop(0.5, '#F4C500');
  sky.addColorStop(1, '#0000FF');
  g.fillStyle = sky;
  g.fillRect(0, 0, 1280, 720);
  g.fillStyle = '#000';
  g.beginPath();
  g.arc(640, 360, 200, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.fillRect(100, 100, 220, 120);
  return c.toDataURL('image/png');
};

const ours = await browser.newPage();
ours.setDefaultNavigationTimeout(40_000);
await ours.goto('http://localhost:5196/?harness');
await ours.waitForFunction(() => 'mb' in window);
const image = await ours.evaluate(makeImage);

const original = await browser.newPage({ viewport: { width: 1280, height: 720 } });
original.setDefaultNavigationTimeout(40_000);
await original.goto('http://localhost:5196/tests/fixtures/ascii-original.html');
await original.waitForFunction(() => 'mountAscii' in window);

for (const [name, colorMode] of [['color', 'color'], ['oscuro', 'dark']] as const) {
  await original.evaluate(({ image, colorMode }) => (window as any).mountAscii({ mediaSource: image, colorMode, fontSize: 10, isPlaying: false }), { image, colorMode });
  await original.waitForTimeout(1200);
  const ref = await original.evaluate(() => document.querySelector('canvas')!.toDataURL('image/png'));

  const result = await ours.evaluate(
    async ({ image, ref, colorMode }) => {
      const { makeLayer, makeProject } = mb.demo;
      const assets = new mb.AssetLibrary();
      await assets.add('foto', await (await fetch(image)).blob());
      // El original mide en px de pantalla: 10 px a 720p son 15 a un lado corto de 1080.
      const project = makeProject([makeLayer('a', 'ascii', { inputs: { source: { assetId: 'foto' } }, params: { colorMode: { value: colorMode }, fontSize: { value: 15 }, family: { value: 'IBM Plex Mono' } } })], { width: 1280, height: 720 });
      const e = mb.engine(assets);
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
      const [a, b] = [await load(png), await load(ref)];
      let sum = 0;
      // Cobertura por bloques de 32 px: compara la imagen que se forma, no cada letra.
      const block = 32;
      let blocks = 0;
      for (let y = 0; y + block <= a.height; y += block) {
        for (let x = 0; x + block <= a.width; x += block) {
          let da = 0;
          let db = 0;
          for (let j = 0; j < block; j++) {
            for (let i = 0; i < block; i++) {
              const o = ((y + j) * a.width + x + i) * 4;
              da += (a.data[o + 3] / 255) * (a.data[o] + a.data[o + 1] + a.data[o + 2]);
              db += (b.data[o + 3] / 255) * (b.data[o] + b.data[o + 1] + b.data[o + 2]);
            }
          }
          sum += Math.abs(da - db) / (block * block * 3);
          blocks++;
        }
      }
      e.engine.dispose();
      return { png, delta: sum / blocks };
    },
    { image, ref, colorMode },
  );
  const save = (file: string, url: string) => writeFileSync(join(outDir, file), Buffer.from(url.split(',')[1], 'base64'));
  save(`${name}.original.png`, ref);
  save(`${name}.motion-builder.png`, result.png);
  console.log(`${name}: diferencia media por bloque de 32 px, ${result.delta.toFixed(2)} sobre 255`);
}

await browser.close();
await server.close();
process.exit(0);
