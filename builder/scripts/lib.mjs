// Compartido por render.mjs y los tests: levantar Vite y abrir Chrome headless.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright-core";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function args(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const k = a.slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "1";
    out[k] = v;
  }
  return out;
}

/** Vite en un puerto libre (o la URL que se pase con --url). */
export async function serve(url) {
  if (url) return { url: url.replace(/\/$/, "") + "/", close: async () => {} };
  const server = await createServer({ root: ROOT, logLevel: "error", server: { port: 0, host: "127.0.0.1" } });
  await server.listen();
  const addr = server.httpServer.address();
  return { url: `http://127.0.0.1:${addr.port}/`, close: () => server.close() };
}

/** Chrome: CHROME_PATH, o el Chromium de Playwright si está, o el Chrome instalado (Mac). */
export async function launch() {
  const path = process.env.CHROME_PATH || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : null);
  return path
    ? chromium.launch({ executablePath: path, args: ["--no-sandbox"] })
    : chromium.launch({ channel: "chrome" });
}

/** Abre el builder en modo render y espera a que el entorno esté listo. */
export async function openBuilder(browser, base, q) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && console.warn("[página]", m.text()));
  const qs = new URLSearchParams({ render: "1", ...q }).toString();
  await page.goto(`${base}?${qs}`);
  await page.waitForFunction(() => window.__builder && window.__builder.state().envId);
  await page.evaluate(() => window.__builder.ready);
  if (errors.length) throw new Error(errors.join("\n"));
  return { page, errors };
}
