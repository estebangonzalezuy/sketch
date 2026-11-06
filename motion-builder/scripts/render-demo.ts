import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

/**
 * Render de prueba con renderFrame: frames PNG y un MP4 armado con ffmpeg. El export real llega en la etapa (e).
 * Uso: npx vite-node scripts/render-demo.ts <carpeta de salida> [proyecto] [frames]
 */
const [out = 'out', name = 'combo', count = '150'] = process.argv.slice(2);
const outDir = resolve(out);
const framesDir = join(outDir, `${name}-frames`);
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const server = await createServer({ server: { port: 5184 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const page = await browser.newPage();
await page.goto('http://localhost:5184/?harness');
await page.waitForFunction(() => 'mb' in window);

declare const mb: any;

await page.evaluate((name) => {
  const w = window as any;
  w.project = mb.demo[`${name}Project`]();
  w.run = mb.engine();
}, name);

for (let f = 0; f < Number(count); f++) {
  const url = await page.evaluate(async (f) => {
    const w = window as any;
    await w.run.engine.renderFrame(w.project, f, 1);
    return w.run.png();
  }, f);
  writeFileSync(join(framesDir, `${String(f).padStart(5, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
}

const mp4 = join(outDir, `${name}.mp4`);
// H.264 no tiene alfa: se compone sobre negro, si no el color de los píxeles transparentes se vería pleno.
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=black:s=1920x1080:r=30', '-framerate', '30', '-i', join(framesDir, '%05d.png'), '-filter_complex', '[0][1]overlay=shortest=1', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', mp4]);
console.log(`${mp4}: ${count} frames`);

await browser.close();
await server.close();
process.exit(0);
