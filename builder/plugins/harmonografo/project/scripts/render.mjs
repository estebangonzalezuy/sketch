#!/usr/bin/env node
/**
 * Fallback de export: renderiza frame a frame con el MISMO Renderer de la tool (vía Chrome headless)
 * y encodea con ffmpeg a MP4 1080×1350 30 fps H.264 yuv420p. Nunca GIF.
 * Uso: npm run render -- presets/x.json [out.mp4]   |   npm run render -- --preset 0 [out.mp4]
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const URL = process.env.TOOL_URL || "http://127.0.0.1:5191/";
const FPS = 30;
const args = process.argv.slice(2);
const sh = (cmd, a) => new Promise((res, rej) => { const p = spawn(cmd, a, { stdio: ["ignore", "ignore", "inherit"] }); p.on("exit", c => c === 0 ? res() : rej(new Error(cmd + " " + c))); });

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.on("pageerror", e => console.log("[pageerror]", e.message));
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__harmono && window.__harmono.ready(), null, { timeout: 30000 });
const jobs = [];
if (args[0] === "--preset") jobs.push({ p: await page.evaluate(i => window.__harmono.presets[i], +args[1]), out: args[2] });
else if (args[0] === "--all") { const ps = await page.evaluate(() => window.__harmono.presets); ps.forEach((p, i) => jobs.push({ p, out: `out/demo-${String(i + 1).padStart(2, "0")}-${p.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-")}.mp4` })); }
else jobs.push({ p: JSON.parse(await readFile(args[0], "utf8")), out: args[1] });
if (process.env.PALETTE) for (const j of jobs) j.p.palette = +process.env.PALETTE;
for (const { p, out: o } of jobs) {
  const out = o || `out/${p.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-")}.mp4`;
  const n = Math.round((p.drawSeconds + p.holdSeconds) * FPS);
  const tmp = out + ".frames"; await rm(tmp, { recursive: true, force: true }); await mkdir(tmp, { recursive: true });
  const t0 = Date.now();
  // un solo pase: el Renderer reproduce la secuencia desde 0
  const B = 30;
  for (let s = 0; s < n; s += B) {
    const fr = await page.evaluate(([p, s, e, fps]) => window.__harmono.frames(p, s, e, fps), [p, s, Math.min(n, s + B), FPS]);
    for (let k = 0; k < fr.length; k++) await writeFile(path.join(tmp, `f${String(s + k).padStart(5, "0")}.jpg`), Buffer.from(fr[k].split(",")[1], "base64"));
  }
  await sh("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(tmp, "f%05d.jpg"), "-vf", "scale=in_range=pc:out_range=tv,format=yuv420p", "-color_range", "tv", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-r", String(FPS), "-movflags", "+faststart", "-an", out]);
  await rm(tmp, { recursive: true, force: true });
  console.log(`${out}  ${n} cuadros  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
await browser.close();
