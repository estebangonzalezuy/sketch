import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';

/** Text Extruder, entradas, imágenes, blend, presets y plantillas, en Chrome real. */
let server: ViteDevServer;
let browser: Browser;
let page: Page; // motor directo
const URL = 'http://localhost:5194';

declare const mb: any;
declare const editor: any;

/** Diálogos de archivo en memoria, persistidos en localStorage para sobrevivir a recargar. */
const fakeFiles = () => {
  const w = window as any;
  const read = () => JSON.parse(localStorage.getItem('fs') ?? '{}');
  const write = (name: string, value: string) => localStorage.setItem('fs', JSON.stringify({ ...read(), [name]: value }));
  const toBlob = (name: string) => {
    const value = read()[name];
    if (value === undefined) throw new Error(`no existe ${name}`);
    return value.startsWith('data:') ? fetch(value).then((r) => r.blob()) : new Blob([value]);
  };
  const handle = (name: string) => ({
    name,
    getFile: async () => new File([await toBlob(name)], name.split('/').pop()!, { type: name.endsWith('.png') ? 'image/png' : 'application/json' }),
    createWritable: async () => ({
      write: async (data: string | Blob) => {
        if (typeof data === 'string') return write(name, data);
        const url = await new Promise<string>((res) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.readAsDataURL(data);
        });
        write(name, url);
      },
      close: async () => {},
    }),
  });
  const dir = (prefix: string) => ({
    getDirectoryHandle: async (name: string) => dir(`${prefix}${name}/`),
    getFileHandle: async (name: string, o?: { create?: boolean }) => {
      if (!o?.create && read()[prefix + name] === undefined) throw new Error('no existe');
      return handle(prefix + name);
    },
  });
  w.showSaveFilePicker = async (o: { suggestedName: string }) => handle(o.suggestedName);
  w.showOpenFilePicker = async (o: { types: { description: string }[] }) => {
    const wanted = o.types[0].description === 'Imagen' ? '.png' : '.json';
    return [handle(Object.keys(read()).find((n) => n.endsWith(wanted) && !n.startsWith('assets/'))!)];
  };
  w.showDirectoryPicker = async () => dir('');
};

const PNG = () => {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#000';
  g.fillRect(32, 0, 32, 32);
  if (!localStorage.getItem('fs')) localStorage.setItem('fs', JSON.stringify({ 'foto.png': c.toDataURL('image/png') }));
};

async function openEditor(path: string, init?: () => void) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(fakeFiles);
  if (init) await context.addInitScript(init);
  const p = await context.newPage();
  p.setDefaultTimeout(5000);
  p.setDefaultNavigationTimeout(30_000);
  await p.goto(URL + path);
  await p.waitForFunction(() => 'editor' in window);
  await p.evaluate(() => editor.preview.idle());
  return p;
}

const hash = async (p: Page) => {
  await p.evaluate(() => editor.preview.idle());
  return p.evaluate(() => editor.hash());
};
const project = (p: Page) => p.evaluate(() => editor.store.getState().project);
const pick = async (p: Page, scope: string, label: string) => {
  await p.locator(`${scope} button`).first().click();
  await p.locator('.dialkit-select-dropdown .dialkit-select-option', { hasText: label }).first().click();
};

beforeAll(async () => {
  server = await createServer({ server: { port: 5194 }, logLevel: 'error' });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
  page = await browser.newPage();
  page.setDefaultNavigationTimeout(30_000);
  await page.goto(`${URL}/?harness`);
  await page.waitForFunction(() => 'mb' in window);
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe('Text Extruder', () => {
  it('frame 120 igual en orden y saltando directo', async () => {
    const r = await page.evaluate(async () => {
      const p = mb.demo.extruderProject();
      const ordered = mb.engine();
      for (let f = 0; f < 120; f += 3) await ordered.render(p, f, 0.5);
      const inOrder = await ordered.render(p, 120, 0.5);
      const other = await ordered.render(p, 7, 0.5);
      const again = await ordered.render(p, 120, 0.5);
      ordered.engine.dispose();
      const fresh = mb.engine();
      const direct = await fresh.render(p, 120, 0.5);
      fresh.engine.dispose();
      return { inOrder, other, again, direct };
    });
    expect(r.direct).toBe(r.inOrder);
    expect(r.again).toBe(r.inOrder);
    expect(r.other).not.toBe(r.inOrder);
  }, 60_000);

  it('dos instancias conviven sin pisarse', async () => {
    const r = await page.evaluate(async () => {
      const { makeLayer, makeProject } = mb.demo;
      const a = makeLayer('a', 'text-extruder', { params: { text: { value: 'UNO' }, family: { value: 'Geist Mono' }, weight: { value: 'Bold' }, floor: { value: false } } });
      const b = makeLayer('b', 'text-extruder', { params: { text: { value: 'DOS' }, family: { value: 'Geist Mono' }, weight: { value: 'Thin' }, look: { value: 'neon' }, floor: { value: false } } });
      const solo = async (layer: any) => {
        const e = mb.engine();
        await e.render(makeProject([layer]), 30, 0.5);
        const h = await e.hash(layer.id);
        e.engine.dispose();
        return h;
      };
      const [soloA, soloB] = [await solo(a), await solo(b)];
      const e = mb.engine();
      await e.render(makeProject([a, b]), 30, 0.5);
      const [togetherA, togetherB] = [await e.hash('a'), await e.hash('b')];
      e.engine.dispose();
      return { soloA, soloB, togetherA, togetherB };
    });
    expect(r.togetherA).toBe(r.soloA);
    expect(r.togetherB).toBe(r.soloB);
    expect(r.soloA).not.toBe(r.soloB);
  }, 60_000);

  it('en loop cierra, también en spin', async () => {
    const same = await page.evaluate(async () => {
      const { makeLayer, makeProject } = mb.demo;
      const out = [];
      for (const anim of ['turntable', 'wave', 'spin', 'swing']) {
        const p = makeProject([makeLayer('t', 'text-extruder', { durationFrames: 300, loopFrames: 90, params: { text: { value: 'OK' }, family: { value: 'Geist Mono' }, weight: { value: 'Bold' }, anim: { value: anim }, speed: { value: 0.2 }, floor: { value: false } } })]);
        const e = mb.engine();
        const first = await e.render(p, 0, 0.25);
        const mid = await e.render(p, 40, 0.25);
        const wrapped = await e.render(p, 90, 0.25);
        e.engine.dispose();
        out.push(first === wrapped && first !== mid);
      }
      return out;
    });
    expect(same).toEqual([true, true, true, true]);
  }, 60_000);

  it('fondo transparente por defecto: el alfa llega al compositor', async () => {
    const alpha = await page.evaluate(async () => {
      const p = mb.demo.extruderProject();
      const e = mb.engine();
      await e.render(p, 0, 0.25);
      const px = e.pixels();
      e.engine.dispose();
      return { corner: px[3], max: px.reduce((m: number, v: number, i: number) => (i % 4 === 3 && v > m ? v : m), 0) };
    });
    expect(alpha).toEqual({ corner: 0, max: 255 });
  });
});

describe('ASCII', () => {
  it('frame 120 igual en orden y saltando directo', async () => {
    const r = await page.evaluate(async () => {
      const p = mb.demo.asciiProject();
      const ordered = mb.engine();
      for (let f = 0; f < 120; f += 3) await ordered.render(p, f, 0.5);
      const inOrder = await ordered.render(p, 120, 0.5);
      const other = await ordered.render(p, 119, 0.5);
      const again = await ordered.render(p, 120, 0.5);
      ordered.engine.dispose();
      const fresh = mb.engine();
      const direct = await fresh.render(p, 120, 0.5);
      fresh.engine.dispose();
      return { inOrder, other, again, direct };
    });
    expect(r.direct).toBe(r.inOrder);
    expect(r.again).toBe(r.inOrder);
    expect(r.other).not.toBe(r.inOrder);
  }, 60_000);

  it('dos instancias conviven sin pisarse', async () => {
    const r = await page.evaluate(async () => {
      const { makeLayer, makeProject } = mb.demo;
      const src = makeLayer('src', 'tag-shader', { visible: false });
      const a = makeLayer('a', 'ascii', { seed: 1, inputs: { source: { layerId: 'src' } } });
      const b = makeLayer('b', 'ascii', { seed: 2, inputs: { source: { layerId: 'src' } }, params: { fontSize: { value: 20 }, colorMode: { value: 'color' } } });
      const solo = async (layer: any) => {
        const e = mb.engine();
        await e.render(makeProject([layer, src]), 30, 0.5);
        const h = await e.hash(layer.id);
        e.engine.dispose();
        return h;
      };
      const [soloA, soloB] = [await solo(a), await solo(b)];
      const e = mb.engine();
      await e.render(makeProject([a, b, src]), 30, 0.5);
      const [togetherA, togetherB] = [await e.hash('a'), await e.hash('b')];
      e.engine.dispose();
      return { soloA, soloB, togetherA, togetherB };
    });
    expect(r.togetherA).toBe(r.soloA);
    expect(r.togetherB).toBe(r.soloB);
    expect(r.soloA).not.toBe(r.soloB);
  }, 60_000);

  it('tolera una entrada null y cierra en loop', async () => {
    const r = await page.evaluate(async () => {
      const { makeLayer, makeProject } = mb.demo;
      const e = mb.engine();
      const empty = makeProject([makeLayer('a', 'ascii')]);
      await e.render(empty, 5, 0.25);
      const alpha = e.pixels().reduce((m: number, v: number, i: number) => (i % 4 === 3 && v > m ? v : m), 0);
      const looped = makeProject([makeLayer('a', 'ascii', { loopFrames: 90, params: { showPattern: { value: true } } })]);
      const first = await e.render(looped, 0, 0.25);
      const mid = await e.render(looped, 40, 0.25);
      const wrapped = await e.render(looped, 90, 0.25);
      e.engine.dispose();
      return { alpha, first, mid, wrapped };
    });
    expect(r.alpha).toBe(0);
    expect(r.wrapped).toBe(r.first);
    expect(r.mid).not.toBe(r.first);
  }, 60_000);

  it('la grilla es la misma a toda escala', async () => {
    const r = await page.evaluate(async () => {
      const p = mb.demo.asciiProject();
      const e = mb.engine();
      await e.render(p, 30, 1);
      const full = e.pixels();
      await e.render(p, 30, 0.5);
      const half = e.pixels();
      e.engine.dispose();
      let sum = 0;
      for (let y = 0; y < 540; y += 2) for (let x = 0; x < 960; x += 2) {
        let a = 0;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) a += full[((y * 2 + dy) * 1920 + x * 2 + dx) * 4 + 3];
        sum += Math.abs(a / 4 - half[(y * 960 + x) * 4 + 3]);
      }
      return sum / (270 * 480);
    });
    expect(r).toBeLessThan(40);
  }, 60_000);
});

describe('las cuatro tools', () => {
  it('corren a la vez y el orden no cambia el frame', async () => {
    const r = await page.evaluate(async () => {
      const { makeLayer, makeProject } = mb.demo;
      const p = makeProject([
        makeLayer('texto', 'text', { params: { size: { value: 200 }, color: { value: '#FF0000' }, align: { value: 'center' } } }),
        makeLayer('ascii', 'ascii', { blend: 'screen', inputs: { source: { layerId: 'extruder' } } }),
        makeLayer('tag', 'tag-shader', { inputs: { source: { layerId: 'extruder' } } }),
        makeLayer('extruder', 'text-extruder', { visible: false, params: { text: { value: 'MB' }, family: { value: 'Geist Mono' }, weight: { value: 'Bold' }, size: { value: 2 }, anim: { value: 'wave' }, floor: { value: false } } }),
      ]);
      const e = mb.engine();
      for (const f of [0, 40, 80]) await e.render(p, f, 0.5);
      const a = await e.render(p, 120, 0.5);
      e.engine.dispose();
      const fresh = mb.engine();
      const b = await fresh.render(p, 120, 0.5);
      fresh.engine.dispose();
      return { a, b };
    });
    expect(r.a).toBe(r.b);
  }, 60_000);
});

describe('blend', () => {
  it('los cuatro modos dan el color esperado', async () => {
    const r = await page.evaluate(async () => {
      const { makeLayer, makeProject } = mb.demo;
      const flat = (id: string, c: string, blend = 'normal') => makeLayer(id, 'tag-shader', { blend, params: { c0: { value: c }, c2: { value: c }, density: { value: 0 } } });
      const out: Record<string, number> = {};
      const e = mb.engine();
      for (const blend of ['normal', 'add', 'multiply', 'screen']) {
        await e.render(makeProject([flat('top', '#804020', blend), flat('bottom', '#408040')]), 0, 0.1);
        out[blend] = e.pixels()[0];
      }
      await e.render(makeProject([{ ...flat('top', '#FF0000'), opacity: { value: 0.5 } }, flat('bottom', '#000000')]), 0, 0.1);
      out.opacity = e.pixels()[0];
      e.engine.dispose();
      return out;
    });
    expect(r.normal).toBe(0x80);
    expect(r.add).toBe(0xc0);
    expect(r.multiply).toBeCloseTo((0x80 * 0x40) / 255, -0.5);
    expect(r.screen).toBeCloseTo(0x80 + 0x40 - (0x80 * 0x40) / 255, -0.5);
    expect(r.opacity).toBe(128);
  }, 30_000);
});

describe('editor', () => {
  it('Text Extruder → Tag Shader en vivo desde el panel', async () => {
    const p = await openEditor('/?demo=extruder');
    await p.locator('[data-add-tool="tag-shader"]').click();
    const demoSource = await hash(p);
    await pick(p, '[data-input="source"]', 'extruder');
    const [top] = (await project(p)).layers;
    expect(top.inputs.source).toEqual({ layerId: 'extruder' });
    const fed = await hash(p);
    expect(fed).not.toBe(demoSource);
    await p.evaluate(() => editor.store.setFrame(60));
    expect(await hash(p)).not.toBe(fed); // la entrada está viva: cambia con el frame
    await p.keyboard.press('Meta+z');
    expect((await project(p)).layers[0].inputs.source).toBeUndefined();
    await p.context().close();
  }, 30_000);

  it('Text Extruder → ASCII en vivo desde el panel', async () => {
    const p = await openEditor('/?demo=extruder');
    await p.locator('[data-add-tool="ascii"]').click();
    await pick(p, '[data-input="source"]', 'extruder');
    expect((await project(p)).layers[0].inputs.source).toEqual({ layerId: 'extruder' });
    const fed = await hash(p);
    await p.evaluate(() => editor.store.setFrame(60));
    expect(await hash(p)).not.toBe(fed);
    expect(await p.evaluate(() => editor.preview.error)).toBeNull();
    await p.context().close();
  }, 30_000);

  it('un ciclo se rechaza con mensaje claro y no entra al proyecto', async () => {
    const p = await openEditor('/?demo=twoTags');
    await pick(p, '[data-input="source"]', 'abajo');
    expect((await project(p)).layers[0].inputs.source).toEqual({ layerId: 'abajo' });
    await p.locator('[data-layer="abajo"] .layer-name').click();
    await p.waitForTimeout(300);
    await pick(p, '[data-input="source"]', 'arriba');
    await expect.poll(() => p.getByRole('alert').first().textContent()).toBe('Ciclo de entradas: arriba → abajo → arriba');
    expect((await project(p)).layers[1].inputs.source).toBeUndefined();
    expect(await p.evaluate(() => editor.preview.error)).toBeNull();
    await p.context().close();
  }, 30_000);

  it('una imagen entra como asset, y guardar y reabrir da el mismo hash', async () => {
    const p = await openEditor('/?demo=tag', PNG);
    const before = await hash(p);
    await p.getByRole('button', { name: 'Importar imagen' }).click();
    await expect.poll(async () => (await project(p)).assets.length || (await p.getByRole('alert').allTextContents()).join()).toBe(1);
    const saved = await project(p);
    expect(saved.assets[0].path).toBe('assets/asset-1-foto.png');
    expect(saved.layers[0].inputs.source).toEqual({ assetId: 'asset-1' });
    const fed = await hash(p);
    expect(fed).not.toBe(before);

    await p.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect.poll(() => p.locator('.dirty').textContent()).toBe('Guardado');
    const files = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('fs')!)));
    expect(files).toContain('assets/asset-1-foto.png');

    const other = await p.context().newPage();
    other.setDefaultTimeout(5000);
    await other.goto(`${URL}/`);
    await other.waitForFunction(() => 'editor' in window);
    await other.getByRole('button', { name: 'Abrir' }).click();
    await expect.poll(async () => (await project(other)).assets.length).toBe(1);
    expect(await hash(other)).toBe(fed);
    await p.context().close();
  }, 30_000);

  it('si falta la imagen, avisa y la entrada queda en null', async () => {
    const r = await page.evaluate(async () => {
      const { makeLayer, makeProject } = mb.demo;
      const e = mb.engine();
      const missing = await e.render(makeProject([makeLayer('t', 'tag-shader', { inputs: { source: { assetId: 'nada' } } })]), 5, 0.25);
      const none = await e.render(makeProject([makeLayer('t', 'tag-shader')]), 5, 0.25);
      e.engine.dispose();
      return missing === none;
    });
    expect(r).toBe(true);
  });

  it('un preset escribe los valores y se deshace de una vez', async () => {
    const p = await openEditor('/?demo=extruder');
    await pick(p, '[data-presets]', 'Cromo');
    const { params } = (await project(p)).layers[0];
    expect(params.look).toEqual({ value: 'chrome' });
    expect(params.metalness).toEqual({ value: 1 });
    await p.keyboard.press('Meta+z');
    expect((await project(p)).layers[0].params.metalness).toBeUndefined();
    await p.context().close();
  }, 30_000);

  it('un preset propio se guarda aparte y sobrevive a recargar', async () => {
    const p = await openEditor('/?demo=extruder');
    p.on('dialog', (d) => d.accept('Mi preset'));
    await p.evaluate(() => editor.store.edit((pr: any) => ({ ...pr, layers: pr.layers.map((l: any) => ({ ...l, params: { ...l.params, roughness: { value: 0.33 } } })) })));
    await p.getByRole('button', { name: 'Guardar preset' }).click();
    expect(await p.evaluate(() => JSON.parse(localStorage.getItem('motion-builder.presets.text-extruder')!)['Mi preset'].roughness)).toBe(0.33);
    expect(await p.evaluate(() => editor.store.getState().project.layers[0].params.roughness)).toEqual({ value: 0.33 });
    await p.reload();
    await p.waitForFunction(() => 'editor' in window);
    await pick(p, '[data-presets]', 'Mío · Mi preset');
    expect((await project(p)).layers[0].params.roughness).toEqual({ value: 0.33 });
    await p.context().close();
  }, 30_000);

  it.each([
    ['reboot:0', 'Reboot', 1920],
    ['tmsc:0', 'tMSC', 1080],
  ])('un proyecto arranca desde la plantilla %s', async (value, name, width) => {
    const p = await openEditor('/');
    const blank = await hash(p);
    await p.getByLabel('Nuevo proyecto').selectOption(value);
    await expect.poll(async () => (await project(p)).layers.length).toBeGreaterThan(0);
    expect((await project(p)).width).toBe(width);
    expect(await hash(p)).not.toBe(blank);
    await expect.poll(() => p.getByLabel('Marca').locator('h2').textContent()).toBe(name);
    expect(await p.locator('[data-brand-pending] li').count()).toBeGreaterThan(0);
    expect(await p.evaluate(() => (window as any).editor.preview.error)).toBeNull();
    await p.context().close();
  }, 30_000);

  it('las paletas de la plantilla aparecen como presets', async () => {
    const p = await openEditor('/');
    await p.getByLabel('Nuevo proyecto').selectOption('tmsc:0');
    await expect.poll(async () => (await project(p)).layers.length).toBe(2);
    await p.evaluate(() => editor.store.select('fondo'));
    await pick(p, '[data-presets]', 'Marca · azul/blanco');
    expect((await project(p)).layers[1].params.c0).toEqual({ value: '#0000FF' });
    await p.context().close();
  }, 30_000);
});
