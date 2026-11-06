import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { createServer, type Plugin, type ViteDevServer } from 'vite';

/**
 * Editor real en Chrome, con mouse y teclado. El plugin registra una tool de prueba y agrega un parámetro
 * a Texto al servir los archivos: si el panel los muestra, la UI no conoce ninguna tool en particular.
 */
const schemaChange: Plugin = {
  name: 'schema-change',
  enforce: 'pre',
  transform(code, id) {
    if (id.endsWith('/src/tools/index.ts')) {
      return `import probe from '/tests/fixtures/probeTool.ts';\n${code.replace('[text, tagShader, textExtruder, ascii, chart, table, counter, pixelate]', '[text, tagShader, textExtruder, ascii, chart, table, counter, pixelate, probe]')}`;
    }
    if (id.endsWith('/src/tools/text/index.ts')) {
      return code.replace("rise: {", "extraDePrueba: { kind: 'number', default: 3, min: 0, max: 10, animate: 'frame', group: 'Grupo nuevo' },\n    rise: {");
    }
  },
};

let server: ViteDevServer;
let browser: Browser;
let page: Page;
const errors: string[] = [];

declare const editor: any;

const idle = () => page.evaluate(() => editor.preview.idle());
const hash = async () => {
  await idle();
  return page.evaluate(() => editor.hash());
};
const project = () => page.evaluate(() => editor.store.getState().project);

/** Arrastra el slider de una fila hasta una fracción de su ancho. */
async function dragSlider(paramId: string, from: number, to: number) {
  await page.locator(`[data-param="${paramId}"] .param-control`).scrollIntoViewIfNeeded();
  const box = (await page.locator(`[data-param="${paramId}"] .param-control`).boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * from, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width * (from + ((to - from) * i) / 8), y);
  await page.mouse.up();
}

beforeAll(async () => {
  server = await createServer({ plugins: [schemaChange], server: { port: 5187 }, logLevel: 'error' });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(4000);
  page.setDefaultNavigationTimeout(30_000);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => void (m.type() === 'error' && errors.push(m.text())));
  await page.goto('http://localhost:5187/?demo=text');
  await page.waitForFunction(() => 'editor' in window);
  await idle();
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe('panel generado desde el schema', () => {
  it('cambiar params en una tool actualiza el panel sin tocar código de UI', async () => {
    await expect(page.locator('[data-param="extraDePrueba"]').count()).resolves.toBe(1);
    await expect(page.getByText('Grupo nuevo').count()).resolves.toBe(1);
  });

  it('marca los parámetros rebuild y no ofrece key en los fijos', async () => {
    await page.locator('[data-add-tool="tag-shader"]').click();
    await expect(page.locator('[data-param="rowHeight"] .rebuild-mark').count()).resolves.toBe(1);
    await expect(page.locator('[data-param="zoom"] .rebuild-mark').count()).resolves.toBe(0);
    await expect(page.locator('[data-param="family"] .key-button').count()).resolves.toBe(0);
    await page.keyboard.press('Meta+z');
  });

  it('agregar una tool de prueba solo exige registrarla', async () => {
    const before = await hash();
    await page.locator('[data-add-tool="probe"]').click();
    for (const id of ['fill', 'size', 'on', 'where', 'shape', 'note']) {
      await expect(page.locator(`[data-param="${id}"]`).count()).resolves.toBe(1);
    }
    expect(await hash()).not.toBe(before);
    await page.keyboard.press('Meta+z');
    expect(await hash()).toBe(before);
  });
});

describe('edición', () => {
  it('mover un control actualiza preview y proyecto, y undo vuelve todo', async () => {
    const before = await hash();
    await page.evaluate(() => editor.store.setFrame(200));
    const start = await hash();
    expect(start).not.toBe(before);

    await dragSlider('size', 0.2, 0.6);
    const moved = (await project()).layers[0].params.size;
    expect(moved.value).toBeGreaterThan(280);
    const after = await hash();
    expect(after).not.toBe(start);

    await page.keyboard.press('Meta+z');
    expect((await project()).layers[0].params.size.value).toBe(280);
    expect(await hash()).toBe(start);

    await page.keyboard.press('Meta+Shift+z');
    expect((await project()).layers[0].params.size.value).toBe(moved.value);
    expect(await hash()).toBe(after);
    await page.keyboard.press('Meta+z');
  });

  it('un arrastre completo es un solo paso de undo', async () => {
    const steps = await page.evaluate(() => editor.store.getState().past.length);
    await dragSlider('size', 0.2, 0.5);
    expect(await page.evaluate(() => editor.store.getState().past.length)).toBe(steps + 1);
    await page.keyboard.press('Meta+z');
  });

  it('los valores salen del proyecto y no del store de DialKit', async () => {
    const value = () => page.locator('[data-param="size"] .dialkit-slider-value').first().textContent();
    // Se escribe directo en el proyecto, sin pasar por el control: el control lo refleja.
    await page.evaluate(() =>
      editor.store.edit((p: any) => ({
        ...p,
        layers: p.layers.map((l: any, i: number) => (i === 0 ? { ...l, params: { ...l.params, size: { value: 123 } } } : l)),
      })),
    );
    await expect.poll(value).toBe('123.0');
    await page.keyboard.press('Meta+z');
    await expect.poll(value).toBe('280.0');
    for (const file of ['ParamsPanel.tsx', 'LayersPanel.tsx', 'App.tsx']) {
      expect(readFileSync(`src/editor/${file}`, 'utf8')).not.toMatch(/DialStore|useDialKit|DialRoot/);
    }
  });

  it('con keys, el panel muestra el valor del frame y escribe ahí', async () => {
    await page.evaluate(() => editor.store.setFrame(10));
    const reveal = page.locator('[data-param="reveal"] .dialkit-slider-value').first();
    await expect.poll(() => reveal.textContent()).toBe('0.000');
    await page.evaluate(() => editor.store.setFrame(180));
    await expect.poll(() => reveal.textContent()).toBe('1.000');
    await page.locator('[data-param="size"] .key-button').click();
    expect((await project()).layers[0].params.size.keys[0]).toMatchObject({ frame: 180, value: 280 });
    await page.locator('[data-param="size"] .key-button').click();
    expect((await project()).layers[0].params.size).toEqual({ value: 280 });
    await page.keyboard.press('Meta+z');
    await page.keyboard.press('Meta+z');
  });

  it('la lista de capas agrega, selecciona, oculta, reordena y borra', async () => {
    const base = await hash();
    await page.locator('[data-add-tool="tag-shader"]').click();
    const [top] = (await project()).layers;
    expect(top.toolId).toBe('tag-shader');
    await expect(page.locator('[data-param="zoom"]').count()).resolves.toBe(1);
    const covered = await hash();
    expect(covered).not.toBe(base);

    await page.getByRole('button', { name: `Ocultar ${top.name}` }).click();
    expect(await hash()).toBe(base);
    await page.getByRole('button', { name: `Mostrar ${top.name}` }).click();
    await page.getByRole('button', { name: `Bajar ${top.name}` }).click();
    expect((await project()).layers[1].id).toBe(top.id);
    expect(await hash()).not.toBe(covered);
    await page.getByRole('button', { name: `Borrar ${top.name}` }).click();
    expect(await hash()).toBe(base);
    await expect(page.locator('[data-param="text"]').count()).resolves.toBe(1);
  });

  it('cada control escribe en el proyecto con su tipo', async () => {
    await page.locator('[data-add-tool="probe"]').click();
    const params = async () => (await project()).layers[0].params;

    await page.locator('[data-param="on"] [role="radio"]', { hasText: 'Off' }).click();
    expect((await params()).on).toEqual({ value: false });

    await page.locator('[data-param="note"] textarea:not([inert])').fill('chau');
    expect((await params()).note).toEqual({ value: 'chau' });

    await page.locator('[data-param="shape"] button').first().click();
    await page.getByText('Barra', { exact: true }).click(); // DialKit capitaliza la etiqueta, no el valor
    expect((await params()).shape).toEqual({ value: 'barra' });

    const box = (await page.locator('[data-param="where"] .param-control').boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.5);
    const where = (await params()).where;
    expect(where.value).toHaveLength(2);
    expect(typeof where.value[0]).toBe('number');
    await page.locator('.layer[data-selected="true"] [aria-label^="Borrar"]').click();
  });

  it('play avanza saltando frames y al pausar muestra lo mismo que ese frame fijo', async () => {
    await page.getByRole('button', { name: 'Play' }).click();
    await page.waitForFunction(() => editor.store.getState().frame > 20 || editor.store.getState().frame < 170);
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Pausa' }).click();
    const paused = await hash();
    const frame = await page.evaluate(() => editor.store.getState().frame);
    await page.evaluate(() => editor.store.setFrame(0));
    await hash();
    await page.evaluate((f) => editor.store.setFrame(f), frame);
    expect(await hash()).toBe(paused);
      });

  it('no hay errores en la consola', () => {
    expect(errors).toEqual([]);
  });
});
