import { spawnSync } from 'node:child_process';
import { createWriteStream, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

/**
 * Export real a 4K con las cuatro tools, y comparación del frame 120 contra la preview a escala 1.
 * Uso: npx vite-node scripts/export-check.ts <carpeta de salida> [frames]
 */
const outDir = resolve(process.argv[2] ?? 'out');
const frames = Number(process.argv[3] ?? 300);
mkdirSync(outDir, { recursive: true });

const server = await createServer({ server: { port: 5198 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const page = await browser.newPage();
page.setDefaultTimeout(1_800_000);
page.setDefaultNavigationTimeout(40_000);
await page.goto('http://localhost:5198/?harness');
await page.waitForFunction(() => 'mb' in window);

declare const mb: any;

const stats = await page.evaluate(async (frames) => {
  const w = window as any;
  w.project = { ...mb.demo.fourToolsProject(), width: 3840, height: 2160, durationFrames: frames, name: 'cuatro-tools-4k' };
  const handle = await (await navigator.storage.getDirectory()).getFileHandle('export.mp4', { create: true });
  const file = await handle.createWritable();
  const started = performance.now();
  let peak = 0;
  await mb.exportProject(w.project, mb.tools, new mb.AssetLibrary(), file, {
    format: 'mp4',
    bitrateMbps: 80,
    background: '#000000',
    signal: new AbortController().signal,
    onProgress: () => {
      peak = Math.max(peak, (performance as any).memory?.usedJSHeapSize ?? 0);
    },
  });
  return { seconds: (performance.now() - started) / 1000, peakMB: peak / 1e6 };
}, frames);

// De a pedazos: el archivo no entra en una sola cadena de texto.
const mp4 = join(outDir, 'cuatro-tools-4k.mp4');
const stream = createWriteStream(mp4);
const size = await page.evaluate(async () => ((window as any).file = await (await (await navigator.storage.getDirectory()).getFileHandle('export.mp4')).getFile()).size);
for (let at = 0; at < size; at += 1 << 24) {
  const chunk = await page.evaluate(async ({ at, length }) => {
    const bytes = new Uint8Array(await (window as any).file.slice(at, at + length).arrayBuffer());
    let out = '';
    for (let i = 0; i < bytes.length; i += 32768) out += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(out);
  }, { at, length: 1 << 24 });
  stream.write(Buffer.from(chunk, 'base64'));
}
await new Promise((r) => stream.end(r));

const ref = await page.evaluate(async () => {
  const e = mb.engine();
  e.engine.background = '#000000';
  await e.render((window as any).project, 120, 1);
  const url = e.png();
  e.engine.dispose();
  return url.split(',')[1];
});
const refPath = join(outDir, 'frame-120-preview.png');
const extracted = join(outDir, 'frame-120-mp4.png');
writeFileSync(refPath, Buffer.from(ref, 'base64'));
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-vf', 'select=eq(n\\,120)', '-vsync', '0', '-frames:v', '1', extracted]);
const { stderr } = spawnSync('ffmpeg', ['-hide_banner', '-i', extracted, '-i', refPath, '-lavfi', '[0]format=yuv444p[a];[1]format=yuv444p[b];[a][b]psnr', '-f', 'null', '-'], { encoding: 'utf8' });
const probe = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=width,height,nb_read_frames,duration,bit_rate', '-of', 'csv=p=0', mp4], { encoding: 'utf8' }).stdout.trim();

console.log(`Render y encode: ${stats.seconds.toFixed(1)} s, ${((stats.seconds * 1000) / frames).toFixed(0)} ms por frame, ${(frames / stats.seconds).toFixed(1)} fps`);
console.log(`Heap JS máximo: ${stats.peakMB.toFixed(0)} MB`);
console.log(`Archivo: ${(statSync(mp4).size / 1e6).toFixed(1)} MB · ffprobe: ${probe}`);
console.log(`PSNR frame 120: ${/PSNR.*/.exec(stderr)?.[0]}`);

const png = await page.evaluate(async () => {
  const w = window as any;
  const short = { ...w.project, durationFrames: 30 };
  const handle = await (await navigator.storage.getDirectory()).getFileHandle('export.zip', { create: true });
  const started = performance.now();
  await mb.exportProject(short, mb.tools, new mb.AssetLibrary(), await handle.createWritable(), { format: 'png', bitrateMbps: 0, background: '#000000', signal: new AbortController().signal, onProgress: () => {} });
  return { seconds: (performance.now() - started) / 1000, size: (await handle.getFile()).size };
});
console.log(`Secuencia PNG 4K: ${((png.seconds * 1000) / 30).toFixed(0)} ms por frame, ${(png.size / 30 / 1e6).toFixed(1)} MB por frame`);

await browser.close();
await server.close();
process.exit(0);
