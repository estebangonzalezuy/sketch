import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { decades, niceTicks, parseData } from '../src/tools/chart';
import { digitPosition, formatValue } from '../src/tools/counter';
import { parseTable } from '../src/tools/table';

describe('datos', () => {
  it('Chart lee puntos y descarta líneas rotas', () => {
    expect(parseData('A | 1 | 2 | over | nota | r\nroto\nB | x | 3')).toEqual([{ label: 'A', x: 1, y: 2, over: 'over', note: 'nota', side: 'r' }]);
  });

  it('Chart arma ejes redondos', () => {
    expect(niceTicks(16, 50.5)).toEqual([10, 20, 30, 40, 50, 60]);
    expect(decades(1, 40)).toEqual([1, 10, 100]);
  });

  it('Tabla lee grupos y mejores valores', () => {
    const { header, rows } = parseTable('M | A | B\n# Grupo\nx | *1 | 2');
    expect(header).toEqual(['M', 'A', 'B']);
    expect(rows[0]).toEqual({ kind: 'group', label: 'Grupo' });
    expect(rows[1]).toEqual({ kind: 'row', cells: [{ text: 'x', best: false }, { text: '1', best: true }, { text: '2', best: false }] });
  });

  it('Contador formatea y gira el dígito solo al pasar de 9 a 0', () => {
    expect(formatValue(1068, 0, ',')).toBe('1,068');
    expect(formatValue(1234.5, 2, 'ninguno')).toBe('1234.50');
    expect(formatValue(-1000, 0, '.')).toBe('-1.000');
    expect(digitPosition(14, 10)).toBe(1);
    expect(digitPosition(19.5, 10)).toBeCloseTo(1.5, 6);
    expect(digitPosition(20, 10)).toBe(2);
  });
});

/** Recorre todas las tools y todos sus templates: una tool nueva queda cubierta al registrarla. */
let server: ViteDevServer;
let browser: Browser;
let page: Page;
const URL = 'http://localhost:5199';

declare const mb: any;
declare const editor: any;

beforeAll(async () => {
  server = await createServer({ server: { port: 5199 }, logLevel: 'error' });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
  page = await browser.newPage();
  page.setDefaultTimeout(120_000);
  page.setDefaultNavigationTimeout(30_000);
  await page.goto(`${URL}/?harness`);
  await page.waitForFunction(() => 'mb' in window);
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

/** Proyecto con la tool y, si es un efecto, una fuente visible para él. */
const setup = () =>
  page.evaluate(() => {
    const { makeLayer, makeProject } = mb.demo;
    (window as any).build = (tool: any, template: string | null) => {
      const source = makeLayer('fuente', 'tag-shader', { visible: false, durationFrames: 90 });
      const needs = tool.inputs.some((i: any) => i.required);
      const base = makeProject(needs ? [source] : [], { durationFrames: 90, width: 960, height: 540 });
      const made = mb.addLayerFrom(base, tool, template ?? '');
      return { project: made.project, id: made.id };
    };
  });

describe('templates de animación', () => {
  it('todas las tools traen al menos tres, con parámetros que existen', async () => {
    const report = await page.evaluate(() =>
      mb.tools.flatMap((tool: any) => {
        const errors: string[] = [];
        const names = Object.keys(tool.animations ?? {});
        if (names.length < 3) errors.push(`${tool.id}: ${names.length} templates`);
        for (const [name, t] of Object.entries<any>(tool.animations ?? {})) {
          for (const id of [...Object.keys(t.tracks ?? {}), ...Object.keys(t.values ?? {})]) {
            const spec = tool.params[id];
            if (!spec) errors.push(`${tool.id}/${name}: no existe ${id}`);
            else if (spec.animate === 'none' && id in (t.tracks ?? {})) errors.push(`${tool.id}/${name}: ${id} no se anima`);
          }
        }
        for (const [name, preset] of Object.entries<any>(tool.presets ?? {})) {
          for (const id of Object.keys(preset)) if (!tool.params[id]) errors.push(`${tool.id}/preset ${name}: no existe ${id}`);
        }
        return errors;
      }),
    );
    expect(report).toEqual([]);
  });

  it('cada template anima de verdad, sin errores', async () => {
    await setup();
    const failures = await page.evaluate(async () => {
      const out: string[] = [];
      for (const tool of mb.tools) {
        for (const name of Object.keys(tool.animations ?? {})) {
          const { project } = (window as any).build(tool, name);
          const e = mb.engine();
          try {
            const hashes = new Set<string>();
            for (const f of [0, 30, 60, 89]) hashes.add(await e.render(project, f, 0.5));
            if (hashes.size < 2) out.push(`${tool.id}/${name}: no cambia`);
          } catch (err) {
            out.push(`${tool.id}/${name}: ${(err as Error).message}`);
          }
          e.engine.dispose();
        }
      }
      return out;
    });
    expect(failures).toEqual([]);
  }, 180_000);

  it('el template se adapta a la duración del clip y queda editable', async () => {
    const r = await page.evaluate(() => {
      const { makeLayer, makeProject } = mb.demo;
      const tool = mb.tools.find((t: any) => t.id === 'chart');
      const p = makeProject([makeLayer('a', 'chart', { durationFrames: 201 })]);
      return mb.applyAnimation(p, 'a', tool.animations['Trazo progresivo'], tool.params).layers[0].params.progress.keys.map((k: any) => k.frame);
    });
    expect(r).toEqual([20, 160]);
  });
});

describe('contrato de las tools nuevas', () => {
  it.each(['chart', 'table', 'counter', 'pixelate'])('%s: el orden no cambia el frame y dos instancias conviven', async (id) => {
    await setup();
    const r = await page.evaluate(async (id) => {
      const tool = mb.tools.find((t: any) => t.id === id);
      const name = Object.keys(tool.animations)[0];
      const { project } = (window as any).build(tool, name);
      const ordered = mb.engine();
      for (let f = 0; f < 40; f += 4) await ordered.render(project, f, 0.5);
      const inOrder = await ordered.render(project, 40, 0.5);
      ordered.engine.dispose();
      const fresh = mb.engine();
      const direct = await fresh.render(project, 40, 0.5);
      fresh.engine.dispose();

      const second = (window as any).build(tool, Object.keys(tool.animations)[1]);
      const layerA = project.layers[0];
      const layerB = { ...second.project.layers[0], id: 'otra' };
      const both = { ...project, layers: [layerB, ...project.layers] };
      const e = mb.engine();
      await e.render(project, 40, 0.5);
      const solo = await e.hash(layerA.id);
      e.engine.dispose();
      const t = mb.engine();
      await t.render(both, 40, 0.5);
      const together = await t.hash(layerA.id);
      t.engine.dispose();
      return { inOrder, direct, solo, together };
    }, id);
    expect(r.direct).toBe(r.inOrder);
    expect(r.together).toBe(r.solo);
  }, 60_000);

  it('Pixelado sin entrada queda transparente', async () => {
    const alpha = await page.evaluate(async () => {
      const { makeLayer, makeProject } = mb.demo;
      const e = mb.engine();
      await e.render(makeProject([makeLayer('p', 'pixelate')]), 0, 0.25);
      const v = e.pixels().reduce((m: number, x: number, i: number) => (i % 4 === 3 && x > m ? x : m), 0);
      e.engine.dispose();
      return v;
    });
    expect(alpha).toBe(0);
  });

  it('Chart: en progreso 0 no hay datos y en 1 están todos', async () => {
    const r = await page.evaluate(async () => {
      const p = mb.demo.chartProject();
      const e = mb.engine();
      const start = await e.render(p, 35, 0.5);
      const before = await e.render(p, 30, 0.5);
      const end = await e.render(p, 280, 0.5);
      e.engine.dispose();
      return { start, before, end };
    });
    expect(r.end).not.toBe(r.before);
    expect(r.start).not.toBe(r.end);
  }, 30_000);
});

describe('zoom de capa', () => {
  it('funciona en todas las tools, también como entrada', async () => {
    await setup();
    const failures = await page.evaluate(async () => {
      const out: string[] = [];
      for (const tool of mb.tools) {
        const { project, id } = (window as any).build(tool, null);
        const zoomed = { ...project, layers: project.layers.map((l: any) => (l.id === id ? { ...l, zoom: { value: 2 } } : l)) };
        const e = mb.engine();
        const plain = await e.render(project, 45, 0.5);
        const big = await e.render(zoomed, 45, 0.5);
        const again = await e.render(project, 45, 0.5);
        e.engine.dispose();
        if (plain === big) out.push(`${tool.id}: no cambia`);
        if (plain !== again) out.push(`${tool.id}: no vuelve`);
      }
      return out;
    });
    expect(failures).toEqual([]);
  }, 120_000);

  it('muestra el centro pedido, y fuera de la capa es transparente', async () => {
    const r = await page.evaluate(async () => {
      const { makeLayer, makeProject } = mb.demo;
      const flat = makeLayer('f', 'tag-shader', { params: { c0: { value: '#FF0000' }, c2: { value: '#FF0000' }, density: { value: 0 } } });
      const e = mb.engine();
      await e.render(makeProject([{ ...flat, zoom: { value: 0.5 } }]), 0, 0.2);
      const px = e.pixels();
      const [w, h] = [384, 216];
      const at = (x: number, y: number) => px[(y * w + x) * 4 + 3];
      const out = { corner: at(2, 2), middle: at(w / 2, h / 2) };
      e.engine.dispose();
      return out;
    });
    expect(r).toEqual({ corner: 0, middle: 255 });
  });

  it('una entrada recibe la capa con su zoom', async () => {
    const r = await page.evaluate(async () => {
      const p = mb.demo.chainProject();
      const zoomed = { ...p, layers: p.layers.map((l: any) => (l.id === 'extruder' ? { ...l, zoom: { value: 3 } } : l)) };
      const e = mb.engine();
      const a = await e.render(p, 30, 0.5);
      const b = await e.render(zoomed, 30, 0.5);
      e.engine.dispose();
      return a !== b;
    });
    expect(r).toBe(true);
  }, 30_000);

  it('cortar una capa con zoom animado no se nota', async () => {
    const r = await page.evaluate(async () => {
      const { makeLayer, makeProject } = mb.demo;
      const p = makeProject([makeLayer('t', 'text', { zoom: { keys: [{ frame: 0, value: 1, ease: [0, 0, 1, 1] }, { frame: 200, value: 3, ease: [0, 0, 1, 1] }] } })]);
      const left = { ...p.layers[0], durationFrames: 100 };
      const right = { ...p.layers[0], id: 'b', start: 100, durationFrames: 200, offset: 100 };
      const e = mb.engine();
      const whole = await e.render(p, 150, 0.5);
      const cut = await e.render({ ...p, layers: [left, right] }, 150, 0.5);
      e.engine.dispose();
      return whole === cut;
    });
    expect(r).toBe(true);
  }, 30_000);
});

describe('editor', () => {
  const open = async (path: string) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const p = await context.newPage();
    p.setDefaultTimeout(5000);
    p.setDefaultNavigationTimeout(30_000);
    await p.goto(URL + path);
    await p.waitForFunction(() => 'editor' in window);
    await p.evaluate(() => editor.preview.idle());
    return p;
  };

  it('agrega una capa con animación, y un efecto toma la capa de abajo', async () => {
    const p = await open('/?demo=text');
    await p.getByLabel('Agregar con animación').selectOption('chart:Trazo progresivo');
    await expect.poll(() => p.evaluate(() => editor.store.getState().project.layers.length)).toBe(2);
    const [chart] = await p.evaluate(() => editor.store.getState().project.layers);
    expect(chart.toolId).toBe('chart');
    expect(chart.params.progress.keys).toHaveLength(2);
    await expect.poll(() => p.locator('[data-track="progress"]').count()).toBe(1);

    await p.getByLabel('Agregar con animación').selectOption('pixelate:Resolver');
    await expect.poll(() => p.evaluate(() => editor.store.getState().project.layers.length)).toBe(3);
    const [pixel] = await p.evaluate(() => editor.store.getState().project.layers);
    expect(pixel.inputs.source).toEqual({ layerId: chart.id });
    await p.keyboard.press('Meta+z');
    expect(await p.evaluate(() => editor.store.getState().project.layers.length)).toBe(2);
    await p.context().close();
  }, 30_000);

  it('anima el zoom desde el panel y aparece en el timeline', async () => {
    const p = await open('/?demo=extruder');
    await p.waitForTimeout(400);
    const before = await p.evaluate(() => editor.hash());
    await p.locator('[data-param="layer.zoom"] .key-button').click();
    await expect.poll(() => p.locator('[data-track="$zoom"]').count()).toBe(1);
    await p.evaluate(() => editor.store.setFrame(100));
    await p.evaluate(() => editor.preview.idle());
    const box = (await p.locator('[data-param="layer.zoom"] .param-control').boundingBox())!;
    await p.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 6 });
    await p.mouse.up();
    const zoom = await p.evaluate(() => editor.store.getState().project.layers[0].zoom);
    expect(zoom.keys.map((k: any) => k.frame)).toEqual([0, 100]);
    expect(zoom.keys[1].value).toBeGreaterThan(1);
    await p.evaluate(() => editor.store.setFrame(0));
    await p.evaluate(() => editor.preview.idle());
    expect(await p.evaluate(() => editor.hash())).toBe(before);
    await p.context().close();
  }, 30_000);

  it('los templates de encuadre aparecen en cualquier tool', async () => {
    const p = await open('/?demo=text');
    await p.waitForTimeout(400);
    await p.locator('[data-animations] button').first().click();
    await p.locator('.dialkit-select-dropdown .dialkit-select-option', { hasText: 'Zoom in' }).first().click();
    const zoom = await p.evaluate(() => editor.store.getState().project.layers[0].zoom);
    expect(zoom.keys.map((k: any) => k.value)).toEqual([1, 2.5]);
    await p.context().close();
  }, 30_000);

  it('Fuente del proyecto reemplaza todo, y KMR Apparat carga sus pesos', async () => {
    const p = await open('/?demo=fourTools');
    await p.getByLabel('Agregar con animación').selectOption('chart:Trazo progresivo');
    await expect.poll(() => p.evaluate(() => editor.store.getState().project.layers.length)).toBe(5);
    await p.evaluate(() => editor.store.setFrame(200)); // el chart ya muestra su texto
    await p.getByLabel('Fuente del proyecto').selectOption('Geist Mono');
    await p.evaluate(() => editor.preview.idle());
    const mono = await p.evaluate(() => editor.hash());
    await p.getByLabel('Fuente del proyecto').selectOption('KMR Apparat');
    await p.evaluate(() => editor.preview.idle());
    const families = await p.evaluate(() => editor.store.getState().project.layers.map((l: any) => l.params.family?.value));
    expect(new Set(families)).toEqual(new Set(['KMR Apparat']));
    expect(await p.evaluate(() => editor.hash())).not.toBe(mono);
    const loaded = await p.evaluate(async () => {
      const out: string[] = [];
      for (const w of [300, 400, 500, 700, 800, 900]) out.push(String((await document.fonts.load(`${w} 40px "KMR Apparat"`)).length));
      return out;
    });
    expect(loaded).toEqual(['1', '1', '1', '1', '1', '1']);
    await p.context().close();
  }, 30_000);

  it('aplica un template desde el panel, y un undo lo saca entero', async () => {
    const p = await open('/?demo=text');
    await p.waitForTimeout(400);
    await p.locator('[data-animations] button').first().click();
    await p.locator('.dialkit-select-dropdown .dialkit-select-option', { hasText: 'Entra y sale' }).first().click();
    const keys = () => p.evaluate(() => editor.store.getState().project.layers[0].params.reveal.keys.map((k: any) => k.frame));
    expect(await keys()).toEqual([0, 105, 209, 299]);
    await p.keyboard.press('Meta+z');
    expect(await keys()).toEqual([10, 180]);
    await p.context().close();
  }, 30_000);
});
