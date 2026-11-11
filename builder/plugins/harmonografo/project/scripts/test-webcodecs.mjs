// Prueba real del botón MP4 (WebCodecs) en Chrome headless: dispara la exportación y guarda la descarga.
import { chromium } from "playwright-core";
const b = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
p.on("console", m => console.log("[console]", m.text()));
p.on("pageerror", e => console.log("[pageerror]", e.message));
await p.goto("http://127.0.0.1:5191/", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const t0 = Date.now();
const dlP = p.waitForEvent("download", { timeout: 240000 });
await p.click("button:text-is('mp4')");
const iv = setInterval(async () => console.log(((Date.now() - t0) / 1000).toFixed(0), "s", await p.textContent("#msg").catch(() => "")), 10000);
const dl = await dlP; clearInterval(iv);
await dl.saveAs(process.argv[2] || "out/test-webcodecs.mp4");
console.log("webcodecs export", ((Date.now() - t0) / 1000).toFixed(1), "s", await p.textContent("#msg"));
await b.close();
