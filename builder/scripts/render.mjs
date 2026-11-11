#!/usr/bin/env node
// Camino 2 del export (fallback, el del reel): Chrome headless + ffmpeg.
//   npm run render -- --env atractor --preset presets/x.json --fmt 4x5 --seconds 12 --out out/x.mp4
// Opcionales: --seed 1842 --pair 1 --inv 1 --url http://localhost:5190/ (usar un server ya levantado)
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { args, launch, openBuilder, serve } from "./lib.mjs";

const a = args();
const preset = a.preset ? JSON.parse(readFileSync(resolve(a.preset), "utf8")) : null;
const env = a.env ?? preset?.env;
if (!env) {
  console.error("falta --env (o un --preset con env)");
  process.exit(1);
}
const fmt = a.fmt ?? preset?.fmt ?? "4x5";
const out = resolve(a.out ?? `out/${env}-${fmt}.mp4`);
mkdirSync(dirname(out), { recursive: true });

const server = await serve(a.url);
const browser = await launch();
const t0 = Date.now();
try {
  const q = { env, fmt };
  if (a.seed) q.seed = a.seed;
  if (a.pair) q.pair = a.pair;
  if (a.inv) q.inv = a.inv;
  const { page } = await openBuilder(browser, server.url, q);
  if (preset) await page.evaluate((p) => window.__builder.loadPreset(p), { ...preset, fmt });
  const seconds = Number(a.seconds ?? (await page.evaluate(() => window.__builder.duration())));
  const total = Math.round(seconds * 30);

  const ff = spawn(
    "ffmpeg",
    [
      "-y", "-loglevel", "error",
      "-f", "image2pipe", "-framerate", "30", "-c:v", "png", "-i", "-",
      "-c:v", "libx264", "-preset", "slow", "-crf", "16",
      "-vf", "scale=in_range=pc:out_range=tv,format=yuv420p",
      "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
      "-r", "30", "-movflags", "+faststart",
      out,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg salió con ${c}`)))));

  for (let i = 0; i < total; i++) {
    const url = await page.evaluate((n) => window.__builder.frame(n), i);
    const buf = Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 30 === 0 || i === total - 1) process.stdout.write(`\r${env} ${i + 1}/${total}`);
  }
  ff.stdin.end();
  await done;
  console.log(`\n${out} · ${total} frames · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
} finally {
  await browser.close();
  await server.close();
}
