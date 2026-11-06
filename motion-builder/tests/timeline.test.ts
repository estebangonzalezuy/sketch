import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';

/** Timeline, curvas y archivos en Chrome real, solo con mouse y teclado. El diálogo nativo se reemplaza por uno en memoria. */
let server: ViteDevServer;
let browser: Browser;
const URL = 'http://localhost:5189';

declare const editor: any;
declare const mb: any;

const fakeFiles = () => {
  const w = window as any;
  const read = () => JSON.parse(localStorage.getItem('files') ?? '{}');
  const handle = (name: string) => ({
    name,
    getFile: async () => new File([read()[name]], name),
    createWritable: async () => ({
      write: async (data: string) => localStorage.setItem('files', JSON.stringify({ ...read(), [name]: data })),
      close: async () => {},
    }),
  });
  w.showSaveFilePicker = async (o: { suggestedName: string }) => handle(o.suggestedName);
  w.showOpenFilePicker = async () => [handle(Object.keys(read())[0])];
};

async function openEditor(context: BrowserContext, path: string) {
  const page = await context.newPage();
  page.setDefaultTimeout(4000);
  page.setDefaultNavigationTimeout(30_000);
  await page.goto(URL + path);
  await page.waitForFunction(() => 'editor' in window);
  await page.evaluate(() => editor.preview.idle());
  return page;
}

const newContext = async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(fakeFiles);
  return context;
};

const hash = async (page: Page) => {
  await page.evaluate(() => editor.preview.idle());
  return page.evaluate(() => editor.hash());
};
const frameHash = async (page: Page, f: number) => {
  await page.evaluate((f) => editor.store.setFrame(f), f);
  return hash(page);
};
const project = (page: Page) => page.evaluate(() => editor.store.getState().project);

/** Pantalla x de un frame del timeline. */
const frameX = async (page: Page, frame: number) => {
  const box = (await page.locator('[data-ruler]').boundingBox())!;
  return box.x + frame * 3 + 1;
};

async function scrub(page: Page, frame: number) {
  const box = (await page.locator('[data-ruler]').boundingBox())!;
  await page.mouse.click(await frameX(page, frame), box.y + 10);
}

async function drag(page: Page, x0: number, y0: number, x1: number, y1 = y0) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / 6, y0 + ((y1 - y0) * i) / 6);
  await page.mouse.up();
}

async function dragSlider(page: Page, paramId: string, to: number) {
  const box = (await page.locator(`[data-param="${paramId}"] .param-control`).boundingBox())!;
  await drag(page, box.x + box.width * 0.5, box.y + box.height / 2, box.x + box.width * to);
}

beforeAll(async () => {
  server = await createServer({ server: { port: 5189 }, logLevel: 'error' });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe('animación creada solo con la UI', () => {
  let context: BrowserContext;
  let page: Page;
  let saved: { file: string; at45: string };

  beforeAll(async () => {
    context = await newContext();
    page = await openEditor(context, '/');
  }, 30_000);

  afterAll(() => context.close());

  it('arma 5 s de animación con keyframes y curva', async () => {
    await page.getByLabel('Duración en segundos').fill('5');
    await page.locator('[data-add-tool="text"]').click();

    await page.locator('[data-param="reveal"] .key-button').click();
    await dragSlider(page, 'reveal', 0);
    await scrub(page, 90);
    await dragSlider(page, 'reveal', 1);

    await scrub(page, 30);
    await page.locator('[data-param="position"] .key-button').click();
    await scrub(page, 120);
    await dragSlider(page, 'size', 0.8);

    const [layer] = (await project(page)).layers;
    expect((await project(page)).durationFrames).toBe(150);
    expect(layer.durationFrames).toBe(150);
    const reveal = layer.params.reveal.keys;
    expect(reveal.map((k: any) => k.frame)).toEqual([0, 90]);
    expect(reveal[0].value).toBe(0);
    expect(reveal[1].value).toBeCloseTo(1);
    expect(layer.params.position.keys[0].frame).toBe(30);
    expect(await frameHash(page, 15)).not.toBe(await frameHash(page, 75));
  }, 30_000);

  it('las pistas muestran los keys y la curva se edita en el panel', async () => {
    await page.locator('[data-key="reveal:0"]').click();
    await expect.poll(() => page.locator('[data-key-curve]').count()).toBe(1);

    await page.waitForTimeout(400); // el panel se abre con una animación
    const handle = (await page.locator('.dialkit-easing-handle').first().boundingBox())!;
    expect(handle.y).toBeGreaterThan(40); // a la vista aunque el panel estuviera scrolleado
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;
    const before = await frameHash(page, 45);
    await drag(page, x, y, x + 50, y - 40);
    const ease = (await project(page)).layers[0].params.reveal.keys[0].ease;
    expect(ease).not.toEqual([0, 0, 1, 1]);
    expect(await hash(page)).not.toBe(before);

    await page.locator('[data-key-curve] button').first().click();
    await page.getByText('Hold', { exact: true }).click();
    expect((await project(page)).layers[0].params.reveal.keys[0].ease).toBe('hold');
    await page.keyboard.press('Meta+z');
    expect((await project(page)).layers[0].params.reveal.keys[0].ease).toEqual(ease);
  });

  it('el último key avisa que no tiene tramo', async () => {
    await page.locator('[data-key="reveal:90"]').click();
    await expect.poll(() => page.getByText('Es el último key').count()).toBe(1);
  });

  it('guardar, reabrir y comparar da el mismo hash', async () => {
    await page.getByLabel('Nombre del proyecto').fill('Prueba');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect.poll(() => page.locator('.dirty').textContent()).toBe('Guardado');
    const file = await page.evaluate(() => JSON.parse(localStorage.getItem('files')!)['Prueba.json']);
    saved = { file, at45: await frameHash(page, 45) };

    const other = await browser.newContext();
    await other.addInitScript(fakeFiles);
    await other.addInitScript((file) => localStorage.setItem('files', JSON.stringify({ 'Prueba.json': file })), file);
    const fresh = await openEditor(other, '/');
    await fresh.getByRole('button', { name: 'Abrir' }).click();
    await expect.poll(() => fresh.evaluate(() => editor.store.getState().project.name)).toBe('Prueba');
    expect(await project(fresh)).toEqual(await project(page));
    expect(await frameHash(fresh, 45)).toBe(saved.at45);
    await other.close();
  });

  it('un archivo inválido no reemplaza al proyecto abierto', async () => {
    await page.evaluate(() => localStorage.setItem('files', JSON.stringify({ 'roto.json': '{"version":1,"fps":"x"}' })));
    await page.getByRole('button', { name: 'Abrir' }).click();
    await expect.poll(() => page.locator('.project-error').count()).toBe(1);
    expect((await project(page)).name).toBe('Prueba');
  });

  it('el autosave recupera el proyecto al recargar', async () => {
    await page.waitForTimeout(1300);
    await page.reload();
    await page.waitForFunction(() => 'editor' in window);
    expect((await project(page)).name).toBe('Prueba');
    expect(await frameHash(page, 45)).toBe(saved.at45);
  });
});

describe('timeline', () => {
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    context = await newContext();
    page = await openEditor(context, '/?demo=combo');
  }, 30_000);

  afterAll(() => context.close());

  const clip = (id: string) => page.locator(`[data-clip="${id}"]`);
  const undo = () => page.keyboard.press('Meta+z');

  it('mover un clip mueve sus keyframes', async () => {
    const before = await frameHash(page, 60);
    const box = (await clip('texto').boundingBox())!;
    await drag(page, box.x + 200, box.y + box.height / 2, box.x + 200 + 30 * 3);

    const [text] = (await project(page)).layers;
    expect(text.start).toBe(30);
    expect(text.params.reveal.keys[0].frame).toBe(10); // relativos al clip
    const key = (await page.locator('[data-key="reveal:10"]').boundingBox())!;
    expect(key.x + key.width / 2).toBeCloseTo(await frameX(page, 40), -1);

    // Se aísla el texto para comparar: el frame 90 movido es el 60 de antes.
    await page.getByRole('button', { name: 'Ocultar tag' }).click();
    const moved = await frameHash(page, 90);
    await undo();
    await undo();
    expect((await project(page)).layers[0].start).toBe(0);
    expect(await frameHash(page, 60)).toBe(before);
    await page.getByRole('button', { name: 'Ocultar tag' }).click();
    expect(await frameHash(page, 60)).toBe(moved);
    await undo();
  });

  it('recorta el clip por ambos extremos, en un solo paso de undo', async () => {
    const steps = await page.evaluate(() => editor.store.getState().past.length);
    const start = (await page.locator('[data-clip="texto"] [data-grip="start"]').boundingBox())!;
    await drag(page, start.x + 4, start.y + 10, start.x + 4 + 30);
    let [text] = (await project(page)).layers;
    expect(text).toMatchObject({ start: 10, durationFrames: 290, offset: 10 });
    expect(text.params.reveal.keys[0].frame).toBe(10);

    const end = (await page.locator('[data-clip="texto"] [data-grip="end"]').boundingBox())!;
    await drag(page, end.x + 4, end.y + 10, end.x + 4 - 60);
    [text] = (await project(page)).layers;
    expect(text.durationFrames).toBe(270);
    expect(await page.evaluate(() => editor.store.getState().past.length)).toBe(steps + 2);
    await undo();
    await undo();
    expect((await project(page)).layers[0]).toMatchObject({ start: 0, durationFrames: 300 });
  });

  it('mueve, agrega y borra keys desde las pistas', async () => {
    const box = (await page.locator('[data-key="reveal:180"]').boundingBox())!;
    await drag(page, box.x + 5, box.y + 5, box.x + 5 - 60);
    const keyFrames = async () => (await project(page)).layers[0].params.reveal.keys.map((k: any) => k.frame);
    expect(await keyFrames()).toEqual([10, 160]);

    await page.keyboard.press('Delete');
    expect(await keyFrames()).toEqual([10]);
    await undo();
    expect(await keyFrames()).toEqual([10, 160]);

    const lane = (await page.locator('[data-track="reveal"] .tl-lane').boundingBox())!;
    await page.mouse.dblclick(await frameX(page, 100), lane.y + lane.height / 2);
    expect(await keyFrames()).toEqual([10, 100, 160]);
    await undo();
    await undo();
    expect(await keyFrames()).toEqual([10, 180]);
  });

  it('reordena capas arrastrando la fila', async () => {
    const top = (await page.locator('[data-layer-row="texto"] .tl-layer-name').boundingBox())!;
    const bottom = (await page.locator('[data-layer-row="tag"] .tl-layer-name').boundingBox())!;
    await drag(page, top.x + 10, top.y + 5, top.x + 10, bottom.y + 5);
    expect((await project(page)).layers.map((l: any) => l.id)).toEqual(['tag', 'texto']);
    await undo();
  });

  it('el playhead sigue al scrub, con snap a frames', async () => {
    await scrub(page, 77);
    expect(await page.evaluate(() => editor.store.getState().frame)).toBe(77);
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => editor.store.getState().frame)).toBe(78);
  });

  it('el zoom cambia la escala sin cambiar el proyecto', async () => {
    const before = (await clip('tag').boundingBox())!.width;
    await page.getByLabel('Zoom del timeline').fill('3');
    expect((await clip('tag').boundingBox())!.width).toBeCloseTo(before * (8 / 3), -2);
    await page.getByLabel('Zoom del timeline').fill('1.6');
  });

  it('pliega las pistas de una capa', async () => {
    await expect.poll(() => page.locator('[data-track="reveal"]').count()).toBe(1);
    await page.getByRole('button', { name: 'Plegar pistas de texto' }).click();
    await expect.poll(() => page.locator('[data-track="reveal"]').count()).toBe(0);
    await page.getByRole('button', { name: 'Desplegar pistas de texto' }).click();
  });

  it('la opacidad animada tiene su pista', async () => {
    await page.evaluate(() => editor.store.select('texto'));
    await page.locator('[data-param="layer.opacity"] .key-button').click();
    await expect.poll(() => page.locator('[data-track="$opacity"]').count()).toBe(1);
    await undo();
  });
});

describe('cortar', () => {
  it('el corte no se ve: todos los frames quedan iguales', async () => {
    const context = await newContext();
    const page = await openEditor(context, '/?demo=fourTools');
    const frames = [0, 89, 90, 91, 200];
    const before: string[] = [];
    for (const f of frames) before.push(await frameHash(page, f));

    await scrub(page, 90);
    await page.getByRole('button', { name: 'Cortar' }).click();
    const layers = (await project(page)).layers;
    expect(layers.length).toBeGreaterThan(4);
    const after: string[] = [];
    for (const f of frames) after.push(await frameHash(page, f));
    expect(after).toEqual(before);

    await page.keyboard.press('Meta+z');
    expect((await project(page)).layers).toHaveLength(4);
    await context.close();
  }, 60_000);

  it('corta con S, y cada parte se mueve por su lado', async () => {
    const context = await newContext();
    const page = await openEditor(context, '/?demo=text');
    await scrub(page, 100);
    await page.keyboard.press('s');
    const [left, right] = (await project(page)).layers;
    expect([left.durationFrames, right.start, right.offset]).toEqual([100, 100, 100]);
    expect(await page.evaluate(() => editor.store.getState().selectedLayerId)).toBe(right.id);

    const box = (await page.locator(`[data-clip="${right.id}"]`).boundingBox())!;
    await drag(page, box.x + 200, box.y + box.height / 2, box.x + 200 + 60);
    const moved = (await project(page)).layers;
    expect(moved[0].start).toBe(0);
    expect(moved[1].start).toBe(120);
    await context.close();
  }, 30_000);
});

describe('borrar capas', () => {
  it('borra con Supr y desde el timeline, y undo las recupera', async () => {
    const context = await newContext();
    const page = await openEditor(context, '/?demo=combo');
    const ids = async () => (await project(page)).layers.map((l: any) => l.id);

    await page.locator('[data-layer="tag"] .layer-name').click();
    await page.keyboard.press('Delete');
    expect(await ids()).toEqual(['texto']);
    expect(await page.evaluate(() => editor.store.getState().selectedLayerId)).toBe('texto');
    await page.keyboard.press('Meta+z');
    expect(await ids()).toEqual(['texto', 'tag']);

    await page.getByRole('button', { name: 'Borrar capa texto' }).click({ force: true });
    expect(await ids()).toEqual(['tag']);
    await page.keyboard.press('Meta+z');
    expect(await ids()).toEqual(['texto', 'tag']);
    await context.close();
  }, 30_000);

  it('con un key seleccionado, Supr borra el key y no la capa', async () => {
    const context = await newContext();
    const page = await openEditor(context, '/?demo=combo');
    await page.locator('[data-key="reveal:180"]').click();
    await page.keyboard.press('Delete');
    expect((await project(page)).layers).toHaveLength(2);
    expect((await project(page)).layers[0].params.reveal.keys).toHaveLength(1);
    await context.close();
  }, 30_000);
});

describe('keyframes en cualquier punto', () => {
  it('un template arranca donde está el playhead', async () => {
    const context = await newContext();
    const page = await openEditor(context, '/?demo=text');
    await scrub(page, 120);
    await page.getByLabel('Agregar con animación').selectOption('counter:Subida rápida');
    await expect.poll(async () => (await project(page)).layers.length).toBe(2);
    const [counter] = (await project(page)).layers;
    expect(counter.params.fade.keys[0].frame).toBe(120);
    expect(counter.params.progress.keys[1].frame).toBeGreaterThan(200);
    await context.close();
  }, 30_000);

  it('con el playhead fuera del clip, ◇ queda deshabilitado', async () => {
    const context = await newContext();
    const page = await openEditor(context, '/?demo=text');
    const end = (await page.locator('[data-clip="texto"] [data-grip="end"]').boundingBox())!;
    await drag(page, end.x + 4, end.y + 10, end.x + 4 - 300);
    await scrub(page, 250);
    await expect.poll(() => page.locator('[data-param="size"] .key-button').isDisabled()).toBe(true);
    await context.close();
  }, 30_000);

  it('Alt mueve la animación entera de la capa', async () => {
    const context = await newContext();
    const page = await openEditor(context, '/?demo=combo');
    const box = (await page.locator('[data-key="mix:90"]').boundingBox())!;
    await page.keyboard.down('Alt');
    await drag(page, box.x + 5, box.y + 5, box.x + 5 + 30);
    await page.keyboard.up('Alt');
    const tag = (await project(page)).layers[1];
    expect(tag.params.mix.keys.map((k: any) => k.frame)).toEqual([100, 210]);
    expect(tag.params.zoom.keys.map((k: any) => k.frame)).toEqual([10, 160]);
    await context.close();
  }, 30_000);
});

describe('preview', () => {
  it('scrub, playback y frame fijo muestran lo mismo', async () => {
    const context = await newContext();
    const page = await openEditor(context, '/?demo=combo');

    await page.getByRole('button', { name: 'Play' }).click();
    const samples: { frame: number; hash: string }[] = await page.evaluate(async () => {
      const out: { frame: number; hash: string }[] = [];
      while (out.length < 8) {
        await new Promise((r) => setTimeout(r, 120));
        const sample = await editor.sample().catch(() => null); // puede caer en medio de un render
        if (sample) out.push(sample);
      }
      return out;
    });
    await page.evaluate(() => editor.store.setPlaying(false));
    expect(new Set(samples.map((s) => s.frame)).size).toBeGreaterThan(4);

    for (const s of samples) {
      await scrub(page, s.frame);
      expect(await hash(page)).toBe(s.hash);
      const fixed = await page.evaluate(async (f) => {
        const e = mb.engine();
        const h = await e.render(editor.store.getState().project, f, 1);
        e.engine.dispose();
        return h;
      }, s.frame);
      expect(fixed).toBe(s.hash);
    }
    await context.close();
  }, 60_000);
});
