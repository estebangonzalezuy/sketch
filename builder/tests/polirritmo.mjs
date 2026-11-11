#!/usr/bin/env node
// Polirritmo en vivo: cruces analíticos (intervalos exactos T/n), BroadcastChannel al Motion Instrument
// (copia del mismo origen en public/motion-instrument) y ventana directa con window.MI.
import { launch, serve } from "../scripts/lib.mjs";

let fails = 0;
const ok = (name, cond, info = "") => {
  console.log(`${cond ? "ok  " : "FALLA"} ${name}${info ? ` · ${info}` : ""}`);
  if (!cond) fails++;
};

const server = await serve(process.env.BUILDER_URL);
const browser = await launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mi = await ctx.newPage();
  await mi.goto(`${server.url}motion-instrument/index.html`);
  await mi.waitForFunction(() => window.MI && typeof window.__miNotes === "number");
  ok("motion instrument (copia) carga con window.MI", true);

  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${server.url}?env=polirritmo&seed=1842&pair=0`);
  await page.waitForFunction(() => window.__builder?.state().envId === "polirritmo");
  // espiar el bus: envolver el sink de WebAudio no hace falta; registramos los `when` desde un sink extra
  await page.evaluate(async () => {
    const mod = await import("/src/core/rhythm.ts");
    window.__whens = [];
    const orig = mod.RhythmBus.prototype.emit;
    mod.RhythmBus.prototype.emit = function (e) {
      window.__whens.push([e.ring, e.when]);
      return orig.call(this, e);
    };
    await window.__builder.loadPreset({ params: { ratios: "3:4", ciclo: { segundos: 4, realineaciones: 1 }, salida: { broadcast: true } } });
  });
  await page.click(".stage");
  await page.waitForTimeout(600);
  await page.evaluate(() => (window.__whens = [])); // solo eventos del preset nuevo
  await page.waitForTimeout(3000);
  const whens = await page.evaluate(() => window.__whens);
  const byRing = [0, 1].map((r) => whens.filter((w) => w[0] === r).map((w) => w[1]));
  const gaps = byRing.map((ws) => ws.slice(1).map((v, i) => v - ws[i]));
  const exp = [4 / 3, 4 / 4];
  const err = gaps.map((g, r) => Math.max(0, ...g.map((d) => Math.abs(d - exp[r]))));
  ok("cruces analíticos: intervalos = T/n", byRing.every((w) => w.length >= 2) && err.every((e) => e < 0.02), `eventos ${byRing.map((w) => w.length).join("+")}, error máx ${(Math.max(...err) * 1000).toFixed(1)} ms`);
  const got = await mi.evaluate(() => window.__miNotes);
  ok("broadcast llega al motion instrument", got > 0, `${got} notas recibidas`);

  // ventana directa (window.MI): el toggle la abre
  const popup = page.waitForEvent("popup", { timeout: 5000 }).catch(() => null);
  await page.evaluate(() => window.__builder.loadPreset({ params: { ratios: "3:4", ciclo: { segundos: 4, realineaciones: 1 }, salida: { motionInstrument: true, broadcast: false } } }));
  const pw = await popup;
  ok("motionInstrument abre la ventana del instrument", !!pw, pw ? pw.url() : "bloqueada");
  ok("sin errores de página", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  await server.close();
}
console.log(fails ? `\n${fails} fallas` : "\ntodo ok");
process.exit(fails ? 1 : 0);
