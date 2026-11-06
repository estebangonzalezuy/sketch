import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';

/** Corre en Chrome real, con WebGL. Cada test crea motores nuevos. */
let server: ViteDevServer;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  server = await createServer({ server: { port: 5181 }, logLevel: 'error' });
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-unsafe-swiftshader'] });
  page = await browser.newPage();
  page.on('pageerror', (e) => console.error(e));
  await page.goto('http://localhost:5181/?harness');
  await page.waitForFunction(() => 'mb' in window);
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

declare const mb: any;

/** Hash del frame 120 tras renderizar 0…120 en orden, y hash tras saltar directo con un motor nuevo. */
const orderHashes = (name: string, step: number) =>
  page.evaluate(
    async ({ name, step }) => {
      const project = mb.demo[name]();
      const ordered = mb.engine();
      for (let f = 0; f < 120; f += step) await ordered.render(project, f, 0.5);
      const inOrder = await ordered.render(project, 120, 0.5);
      const before = await ordered.render(project, 7, 0.5);
      const again = await ordered.render(project, 120, 0.5);
      ordered.engine.dispose();
      const fresh = mb.engine();
      const direct = await fresh.render(project, 120, 0.5);
      fresh.engine.dispose();
      return { inOrder, direct, again, before };
    },
    { name, step },
  );

describe('orden de render', () => {
  it.each([
    ['Texto', 'textProject'],
    ['Tag Shader', 'tagProject'],
  ])('%s: frame 120 igual en orden y saltando directo', async (_, name) => {
    const { inOrder, direct, again, before } = await orderHashes(name, 1);
    expect(direct).toBe(inOrder);
    expect(again).toBe(inOrder);
    expect(before).not.toBe(inOrder); // el hash realmente cambia con el frame
  }, 120_000);
});

describe('capas', () => {
  it('dos Tag Shader conviven sin pisarse', async () => {
    const r = await page.evaluate(async () => {
      const both = mb.demo.twoTagsProject();
      const [top, bottom] = both.layers;
      const solo = async (layer: any) => {
        const e = mb.engine();
        await e.render({ ...both, layers: [layer] }, 120, 0.5);
        const hash = await e.hash(layer.id);
        e.engine.dispose();
        return hash;
      };
      const soloTop = await solo(top);
      const soloBottom = await solo(bottom);

      const e = mb.engine();
      const composite = await e.render(both, 120, 0.5);
      const togetherTop = await e.hash(top.id);
      const togetherBottom = await e.hash(bottom.id);
      // Mismo orden invertido en el proyecto: el render de cada capa no debe enterarse.
      await e.render({ ...both, layers: [bottom, top] }, 120, 0.5);
      const swappedTop = await e.hash(top.id);
      const swappedBottom = await e.hash(bottom.id);
      e.engine.dispose();
      return { soloTop, soloBottom, composite, togetherTop, togetherBottom, swappedTop, swappedBottom };
    });
    expect(r.togetherTop).toBe(r.soloTop);
    expect(r.togetherBottom).toBe(r.soloBottom);
    expect(r.swappedTop).toBe(r.soloTop);
    expect(r.swappedBottom).toBe(r.soloBottom);
    expect(r.soloTop).not.toBe(r.soloBottom);
    expect(r.composite).not.toBe(r.soloBottom);
  }, 120_000);

  it('una instancia sobrevive a dispose de la otra', async () => {
    const same = await page.evaluate(async () => {
      const project = mb.demo.twoTagsProject();
      const a = mb.engine();
      const b = mb.engine();
      const first = await a.render(project, 30, 0.25);
      b.engine.dispose();
      const second = await a.render(project, 30, 0.25);
      a.engine.dispose();
      return first === second;
    });
    expect(same).toBe(true);
  }, 120_000);
});

describe('loop', () => {
  it('Tag Shader cierra: el frame siguiente al último es el primero', async () => {
    const r = await page.evaluate(async () => {
      const { makeLayer, makeProject } = mb.demo;
      const project = makeProject([makeLayer('tag', 'tag-shader', { durationFrames: 300, loopFrames: 150, params: { speed: { value: 0.13 } } })]);
      const e = mb.engine();
      const first = await e.render(project, 0, 0.5);
      const next = await e.render(project, 1, 0.5);
      const wrapped = await e.render(project, 150, 0.5);
      e.engine.dispose();
      return { first, next, wrapped };
    });
    expect(r.wrapped).toBe(r.first);
    expect(r.next).not.toBe(r.first);
  }, 120_000);
});

describe('compositor', () => {
  it('conserva el alfa y respeta visible, opacidad y límites del clip', async () => {
    const r = await page.evaluate(async () => {
      const { makeLayer, makeProject } = mb.demo;
      const text = makeLayer('t', 'text', { start: 10, durationFrames: 10 });
      const alpha = (pixels: number[]) => pixels.reduce((max: number, v: number, i: number) => (i % 4 === 3 && v > max ? v : max), 0);
      const e = mb.engine();
      await e.render(makeProject([text]), 9, 0.25);
      const before = alpha(e.pixels());
      await e.render(makeProject([text]), 10, 0.25);
      const during = alpha(e.pixels());
      await e.render(makeProject([{ ...text, visible: false }]), 10, 0.25);
      const hidden = alpha(e.pixels());
      await e.render(makeProject([{ ...text, opacity: { value: 0.5 } }]), 10, 0.25);
      const half = alpha(e.pixels());
      e.engine.dispose();
      return { before, during, hidden, half };
    });
    expect(r).toEqual({ before: 0, during: 255, hidden: 0, half: 128 });
  }, 60_000);

  it('rechaza un ciclo de entradas con un mensaje claro', async () => {
    const message = await page.evaluate(async () => {
      const { makeLayer, makeProject } = mb.demo;
      const a = makeLayer('a', 'tag-shader', { inputs: { source: { layerId: 'b' } } });
      const b = makeLayer('b', 'tag-shader', { inputs: { source: { layerId: 'a' } } });
      const e = mb.engine();
      const result = await e.render(makeProject([a, b]), 0, 0.25).catch((err: Error) => err.message);
      e.engine.dispose();
      return result;
    });
    expect(message).toBe('Ciclo de entradas: a → b → a');
  }, 60_000);

  it('una capa alimenta a otra y una entrada inactiva llega como null', async () => {
    const r = await page.evaluate(async () => {
      const { makeLayer, makeProject } = mb.demo;
      const source = makeLayer('src', 'text', { visible: false, durationFrames: 10, params: { text: { value: 'OK' }, size: { value: 700 } } });
      const tag = makeLayer('tag', 'tag-shader', { inputs: { source: { layerId: 'src' } } });
      const alone = makeLayer('tag', 'tag-shader');
      const e = mb.engine();
      const fed = await e.render(makeProject([tag, source]), 5, 0.25);
      const noInput = await e.render(makeProject([alone]), 5, 0.25);
      const inactive = await e.render(makeProject([tag, source]), 20, 0.25);
      const demoLater = await e.render(makeProject([alone]), 20, 0.25);
      e.engine.dispose();
      return { fed, noInput, inactive, demoLater };
    });
    expect(r.fed).not.toBe(r.noInput);
    expect(r.inactive).toBe(r.demoLater);
  }, 60_000);
});
