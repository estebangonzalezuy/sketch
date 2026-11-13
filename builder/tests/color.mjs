#!/usr/bin/env node
// Todos los entornos tienen los presets de color: en el panel de cada uno, los 4 pares como botones
// (carpeta "color") + invertir. Se hace clic de verdad y se mira el estado y el fondo del canvas.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { launch, ROOT, serve } from "../scripts/lib.mjs";

const PAIRS = [["ink", "#0C0C0C", "#FFFFFF"], ["ácido", "#0C0C0C", "#E4FC24"], ["lila", "#3C240C", "#CC84FC"], ["magenta", "#0C540C", "#F06CCC"]];
const ENVS = [...readFileSync(resolve(ROOT, "src/envs/index.ts"), "utf8").matchAll(/id: "([^"]+)"[^\n]*load: \(\) => import/g)].map((m) => m[1]);
let fails = 0;
const ok = (name, cond, info = "") => {
  console.log(`${cond ? "ok  " : "FALLA"} ${name}${info ? ` · ${info}` : ""}`);
  if (!cond) fails++;
};

const server = await serve(process.env.BUILDER_URL);
const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 2400 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const env of ENVS) {
    await page.goto(`${server.url}?env=${env}&seed=1842&pair=2`);
    await page.waitForFunction((e) => window.__builder?.state().envId === e, env);
    await page.evaluate(() => window.__builder.ready);
    // colores del canvas entero (muestreado) en el frame 45: cuántos píxeles hay de cada uno
    const counts = () =>
      page.evaluate(() => {
        window.__builder.frame(45); // siempre el mismo cuadro: la preview sigue corriendo y cambiaría la cuenta
        const c = document.querySelector(".stage canvas");
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        const m = {};
        for (let k = 0; k < d.length; k += 4 * 7) {
          const key = "#" + [d[k], d[k + 1], d[k + 2]].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
          m[key] = (m[key] || 0) + 1;
        }
        return m;
      });
    const top = (m, n) => Object.entries(m).sort((x, y) => y[1] - x[1]).slice(0, n).map((e) => e[0]);
    const got = [];
    let last = {};
    for (let i = 0; i < 4; i++) {
      await page.locator(".dialkit-root button", { hasText: new RegExp(`^${PAIRS[i][0]}$`, "i") }).first().click();
      await page.waitForFunction((n) => window.__builder.state().pair === n, i, { timeout: 3000 }).catch(() => {});
      last = await counts();
      // los dos colores del par dominan el canvas (el resto es antialiasing entre ellos)
      got.push((await page.evaluate(() => window.__builder.state().pair)) === i && top(last, 4).includes(PAIRS[i][1]) && top(last, 4).includes(PAIRS[i][2]));
    }
    // invertir: lo que era fondo pasa a ser tinta: en el mismo cuadro, las cantidades se cruzan
    await page.locator(".dialkit-root button", { hasText: /^invertir$/i }).first().click();
    await page.waitForFunction(() => window.__builder.state().invert === true, null, { timeout: 3000 }).catch(() => {});
    const after = await counts();
    const [, bg, fg] = PAIRS[3];
    // 2 % + 50 píxeles muestreados: el antialiasing de trazos finos no es exactamente simétrico al invertir
    const near = (x, y) => Math.abs((x || 0) - (y || 0)) <= 0.02 * Math.max(x || 0, y || 0) + 50;
    const inv = (await page.evaluate(() => window.__builder.state().invert)) && near(after[fg], last[bg]) && near(after[bg], last[fg]);
    if (!inv) console.log("   detalle:", JSON.stringify({ antes: { bg: last[bg], fg: last[fg] }, después: { bg: after[bg], fg: after[fg] }, invert: await page.evaluate(() => window.__builder.state().invert) }));
    const preset = await page.evaluate(() => window.__builder.preset());
    ok(`${env}: 4 pares + invertir desde su panel`, got.every(Boolean) && inv && !("color" in preset.params), `pares ${got.map((g) => (g ? "✓" : "✗")).join("")} invertir ${inv ? "✓" : "✗"}`);
  }
  ok("sin errores de página", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  await server.close();
}
console.log(fails ? `\n${fails} fallas` : "\ntodo ok");
process.exit(fails ? 1 : 0);
