import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';

/**
 * Export real en Chrome. El diálogo de guardar devuelve un archivo del sistema privado del navegador:
 * WebCodecs, muxer y escritura por stream son los de verdad.
 */
let server: ViteDevServer;
let browser: Browser;
const dir = mkdtempSync(join(tmpdir(), 'mb-export-'));

declare const editor: any;
declare const mb: any;

const opfsPicker = () => {
  (window as any).showSaveFilePicker = async (o: { suggestedName: string }) => (await navigator.storage.getDirectory()).getFileHandle(o.suggestedName, { create: true });
};

async function openEditor(path: string, frames: number) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(opfsPicker);
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(30_000);
  await page.goto(`http://localhost:5197${path}`);
  await page.waitForFunction(() => 'editor' in window);
  await page.evaluate((frames) => editor.store.edit((p: any) => ({ ...p, durationFrames: frames, name: 'prueba' })), frames);
  await page.evaluate(() => editor.preview.idle());
  return page;
}

const readFile = (page: Page, name: string) =>
  page.evaluate(async (name) => {
    const file = await (await (await navigator.storage.getDirectory()).getFileHandle(name)).getFile();
    const bytes = new Uint8Array(await file.arrayBuffer());
    let out = '';
    for (let i = 0; i < bytes.length; i += 32768) out += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(out);
  }, name);

const runExport = async (page: Page, timeout = 60_000) => {
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  await page.getByRole('button', { name: 'Exportar a archivo' }).click();
  await page.waitForFunction(() => document.querySelector('.export-status[role="status"]'), undefined, { timeout });
  return page.locator('.export-status[role="status"]').textContent();
};

const previewPng = (page: Page, frame: number, background: string | null) =>
  page.evaluate(
    async ({ frame, background }) => {
      const e = mb.engine();
      e.engine.background = background;
      await e.render(editor.store.getState().project, frame, 1);
      const url = e.png();
      e.engine.dispose();
      return url.split(',')[1];
    },
    { frame, background },
  );

beforeAll(async () => {
  server = await createServer({ server: { port: 5197 }, logLevel: 'error' });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe('MP4', () => {
  it('sale con los frames del proyecto y coincide con la preview', async () => {
    const page = await openEditor('/?demo=combo', 60);
    const status = await runExport(page);
    expect(status).toMatch(/prueba\.mp4: .* MB en/);

    const path = join(dir, 'combo.mp4');
    writeFileSync(path, Buffer.from(await readFile(page, 'prueba.mp4'), 'base64'));
    const [width, height, frames, codec] = execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=width,height,nb_read_frames,codec_name', '-of', 'csv=p=0:nk=1', path]).toString().trim().split(',').sort((a, b) => a.length - b.length);
    expect([width, height, frames, codec].sort()).toEqual(['1080', '1920', '60', 'h264'].sort());

    const refPath = join(dir, 'ref.png');
    writeFileSync(refPath, Buffer.from(await previewPng(page, 30, '#000000'), 'base64'));
    // Primero a PNG: así ambos lados pasan por RGB y se comparan con la misma matriz de color.
    const framePath = join(dir, 'frame.png');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path, '-vf', 'select=eq(n\\,30)', '-vsync', '0', '-frames:v', '1', framePath]);
    const { stderr } = spawnSync('ffmpeg', ['-hide_banner', '-i', framePath, '-i', refPath, '-lavfi', '[0]format=yuv444p[a];[1]format=yuv444p[b];[a][b]psnr', '-f', 'null', '-'], { encoding: 'utf8' });
    // Se mide luminancia: 4:2:0 limita el color a unos 26 dB con estos bordes saturados, aun sin compresión.
    const psnr = Number(/ y:([\d.]+)/.exec(stderr)?.[1]);
    console.log(`PSNR de luminancia del frame 30 contra la preview: ${psnr} dB`);
    expect(psnr).toBeGreaterThan(35);
    await page.context().close();
  }, 90_000);

  it('compone sobre el fondo elegido', async () => {
    const page = await openEditor('/?demo=text', 6);
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    await page.getByLabel('Fondo').fill('#ffffff');
    await page.getByRole('button', { name: 'Exportar a archivo' }).click();
    await page.waitForFunction(() => document.querySelector('.export-status[role="status"]'), undefined, { timeout: 30_000 });
    const path = join(dir, 'white.mp4');
    writeFileSync(path, Buffer.from(await readFile(page, 'prueba.mp4'), 'base64'));
    const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 26 });
    expect(raw[0]).toBeGreaterThan(250);
    await page.context().close();
  }, 60_000);
});

describe('secuencia PNG', () => {
  it('conserva el alfa, con un archivo por frame', async () => {
    const page = await openEditor('/?demo=text', 12);
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    await page.getByLabel('Formato de export').selectOption('png');
    await page.getByRole('button', { name: 'Exportar a archivo' }).click();
    await page.waitForFunction(() => document.querySelector('.export-status[role="status"]'), undefined, { timeout: 60_000 });
    const zip = await readFile(page, 'prueba.zip');
    const files = unzipSync(new Uint8Array(Buffer.from(zip, 'base64')));
    expect(Object.keys(files).sort()[0]).toBe('frame_00.png');
    expect(Object.keys(files)).toHaveLength(12);

    const png = join(dir, 'f.png');
    writeFileSync(png, files['frame_11.png']);
    const alpha = execFileSync('ffmpeg', ['-v', 'error', '-i', png, '-vf', 'alphaextract', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 26 });
    expect(alpha[0]).toBe(0); // esquina transparente
    await page.context().close();
  }, 90_000);

  it('el PNG exportado es el mismo frame de la preview, con alfa', async () => {
    const page = await openEditor('/?demo=combo', 4);
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    await page.getByLabel('Formato de export').selectOption('png');
    await page.getByRole('button', { name: 'Exportar a archivo' }).click();
    await page.waitForFunction(() => document.querySelector('.export-status[role="status"]'), undefined, { timeout: 60_000 });
    const files = unzipSync(new Uint8Array(Buffer.from(await readFile(page, 'prueba.zip'), 'base64')));
    const preview = await previewPng(page, 2, null);
    expect(Buffer.from(files['frame_2.png']).equals(Buffer.from(preview, 'base64'))).toBe(true);
    await page.context().close();
  }, 90_000);
});

describe('cancelar', () => {
  it('no deja el editor en mal estado', async () => {
    const page = await openEditor('/?demo=combo', 300);
    const before = await page.evaluate(() => editor.hash());
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    await page.getByRole('button', { name: 'Exportar a archivo' }).click();
    await page.waitForFunction(() => Number(document.querySelector('progress')?.getAttribute('value') ?? 0) >= 5, undefined, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Cancelar export' }).click();
    await expect.poll(() => page.locator('.export-status[role="status"]').textContent(), { timeout: 10_000 }).toContain('cancelado');
    const size = await page.evaluate(async () => (await (await (await navigator.storage.getDirectory()).getFileHandle('prueba.mp4')).getFile()).size);
    expect(size).toBe(0);

    await page.getByRole('button', { name: 'Cerrar' }).click();
    expect(await page.evaluate(() => editor.hash())).toBe(before);
    await page.evaluate(() => editor.store.setFrame(40));
    await page.evaluate(() => editor.preview.idle());
    const moved = await page.evaluate(() => editor.hash());
    expect(moved).not.toBe(before);
    expect(await page.evaluate(() => editor.preview.error)).toBeNull();

    await page.evaluate(() => editor.store.edit((p: any) => ({ ...p, durationFrames: 8 })));
    expect(await runExport(page)).toMatch(/prueba\.mp4: .* MB en/);
    await page.context().close();
  }, 90_000);
});
