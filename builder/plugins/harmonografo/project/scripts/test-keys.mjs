// Prueba de teclas: r (random), p (paleta), 4 (preset), cantidad de péndulos -> 5.
import { chromium } from "playwright-core";
const b = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = []; p.on("pageerror", e => errs.push(e.message));
await p.goto("http://127.0.0.1:5191/", { waitUntil: "networkidle" }); await p.waitForTimeout(800);
const bg = () => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg"));
const b0 = await bg(); await p.keyboard.press("p"); const b1 = await bg();
await p.keyboard.press("r"); await p.waitForTimeout(300);
const n1 = await p.evaluate(() => document.querySelectorAll(".pend").length);
const rows = await p.$$(".sec .row input[type=range]");
// slider "cantidad" es el primero del bloque péndulos
const cant = await p.$("xpath=//label[text()='cantidad']/following-sibling::input");
await cant.evaluate(el => { el.value = "5"; el.dispatchEvent(new Event("input")); });
await p.waitForTimeout(300);
const n2 = await p.evaluate(() => document.querySelectorAll(".pend").length);
await p.waitForTimeout(4000); await p.screenshot({ path: "out/ui-random-5pend.png" });
console.log({ b0, b1, pendAfterRandom: n1, pendAfterDial: n2, errs });
await b.close();
