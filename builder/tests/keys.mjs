#!/usr/bin/env node
// Atajos globales y sincronización panel DialKit ↔ runtime, con teclado real en la app (no modo render).
import { launch, serve } from "../scripts/lib.mjs";

let fails = 0;
const ok = (name, cond, info = "") => {
  console.log(`${cond ? "ok  " : "FALLA"} ${name}${info ? ` · ${info}` : ""}`);
  if (!cond) fails++;
};

const server = await serve(process.env.BUILDER_URL);
const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${server.url}?env=atractor&seed=1842&pair=0`);
  await page.waitForFunction(() => window.__builder?.state().envId === "atractor");
  await page.evaluate(() => window.__builder.ready);
  await page.click(".stage");
  const st = () => page.evaluate(() => window.__builder.state());
  const pr = () => page.evaluate(() => window.__builder.preset());

  let s = await st();
  await page.keyboard.press(" ");
  ok("espacio pausa", (await st()).playing === !s.playing);
  await page.keyboard.press(" ");

  await page.keyboard.press("c");
  ok("c rota el par", (await st()).pair === 1);
  await page.keyboard.press("p");
  ok("p (alias) rota el par", (await st()).pair === 2);
  await page.keyboard.press("i");
  ok("i invierte", (await st()).invert === true);
  await page.keyboard.press("i");

  const before = await pr();
  await page.keyboard.press("r");
  await page.waitForTimeout(300);
  const after = await pr();
  ok("r cambia semilla y params", after.seed !== before.seed && JSON.stringify(after.params) !== JSON.stringify(before.params), `semilla ${before.seed} → ${after.seed}`);
  // el panel muestra el valor nuevo de "a"
  const shown = await page.evaluate(() => document.querySelector(".dialkit-root")?.textContent ?? "");
  ok("el panel refleja r", shown.includes(String(after.params.a)), `a = ${after.params.a}`);

  await page.keyboard.press("2");
  await page.waitForTimeout(300);
  ok("2 aplica el preset 2", (await pr()).params.a === 1.7);

  // un slider de DialKit con teclado → runtime
  const a0 = (await pr()).params.d;
  const slider = page.locator(".dialkit-root [role=slider]").nth(4); // 0 = semilla (panel builder), 1–4 = a b c d
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  const a1 = (await pr()).params.d;
  ok("slider de DialKit → runtime", a1 !== a0, `d ${a0} → ${a1}`);
  // con foco en DialKit, "c" no rota el par
  const pairBefore = (await st()).pair;
  await page.keyboard.press("c");
  ok("con foco en DialKit los atajos no corren", (await st()).pair === pairBefore);

  await page.click(".stage");
  await page.keyboard.press("]");
  await page.waitForFunction(() => window.__builder.state().envId !== "atractor");
  ok("] pasa al entorno siguiente", true, (await st()).envId);
  await page.keyboard.press("[");
  await page.waitForFunction(() => window.__builder.state().envId === "atractor");
  ok("[ vuelve al anterior", true, "atractor");

  await page.click(".stage");
  // pausado, para que la preview no avance t entre la tecla y la lectura
  if ((await st()).playing) await page.keyboard.press(" ");
  await page.waitForTimeout(300);
  await page.keyboard.press("0");
  ok("0 vuelve a t = 0", (await st()).t === 0, `t = ${(await st()).t}`);
  await page.keyboard.press(" ");

  await page.click(".stage"); // foco fuera de DialKit (con foco adentro los atajos se ignoran a propósito)
  const dl = page.waitForEvent("download", { timeout: 10000 });
  await page.keyboard.press("s");
  const d = await dl;
  ok("s descarga png", d.suggestedFilename().endsWith(".png"), d.suggestedFilename());

  // el select "Entorno" del panel builder (DialKit) cambia de entorno
  await page.evaluate(() => {
    const t = [...document.querySelectorAll(".dialkit-root button, .dialkit-root [role=combobox]")].find((b) => b.textContent.includes("atractor"));
    t?.click();
  });
  await page.waitForTimeout(300);
  const opt = page.locator(".dialkit-root [role=option], .dialkit-select-option").filter({ hasText: "superilla" }).first();
  if (await opt.count()) {
    await opt.click();
    await page.waitForFunction(() => window.__builder.state().envId === "superilla", null, { timeout: 5000 }).catch(() => {});
  }
  ok("select Entorno de DialKit cambia el entorno", (await st()).envId === "superilla", (await st()).envId);

  ok("la url refleja el estado", (await page.evaluate(() => location.search)).includes(`env=${(await st()).envId}`));
  ok("sin errores de página", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  await server.close();
}
console.log(fails ? `\n${fails} fallas` : "\ntodo ok");
process.exit(fails ? 1 : 0);
