#!/usr/bin/env node
/**
 * Drive the running tool and write MP4 demos to tool/out/.
 * This Chrome build does not support AVC WebCodecs, so demos are
 * frame-accurate canvas JPEGs muxed with ffmpeg (H.264 yuv420p).
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const URL = process.env.TOOL_URL || "http://127.0.0.1:5173/";
const MODES = ["trayectorias", "medidas", "contador", "atlas"];
const VIEWS = ["footage", "canvas"];

function sh(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${code}`))));
  });
}

async function record(page, dest, nFrames, fps) {
  const tmp = dest + ".frames";
  if (existsSync(tmp)) await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  const batch = 20;
  for (let start = 0; start < nFrames; start += batch) {
    const end = Math.min(nFrames, start + batch);
    const frames = await page.evaluate(
      async ({ start, end }) => window.__liveTags.frameJpegRange(start, end, 0.92),
      { start, end },
    );
    for (let i = 0; i < frames.length; i++) {
      const b64 = frames[i].split(",")[1];
      const name = `f${String(start + i).padStart(4, "0")}.jpg`;
      await writeFile(path.join(tmp, name), Buffer.from(b64, "base64"));
    }
    console.log(`   frames ${end}/${nFrames}`);
  }
  await sh("ffmpeg", [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    path.join(tmp, "f%04d.jpg"),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "18",
    "-movflags",
    "+faststart",
    "-an",
    dest,
  ]);
  await rm(tmp, { recursive: true, force: true });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME || "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-gpu", "--use-gl=angle", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
  console.log("open", URL);
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForFunction(() => window.__liveTags && window.__liveTags.ready(), { timeout: 30_000 });
  console.log("tool ready");

  const report = [];
  for (const mode of MODES) {
    for (const view of VIEWS) {
      const dest = path.join(OUT, `${mode}-${view}.mp4`);
      const t0 = Date.now();
      console.log(`\n=== ${mode} / ${view} ===`);
      const info = await page.evaluate(async ({ mode, view }) => {
        await window.__liveTags.configure({
          mode,
          view,
          dials: { tamaño: 0.55, ritmo: 0.5, cantidad: 0.85 },
          frame: 0,
        });
        return window.__liveTags.getState();
      }, { mode, view });
      console.log("  nFrames", info.nFrames);
      await record(page, dest, info.nFrames, info.fps);
      const ms = Date.now() - t0;
      console.log("  wrote", dest, `${ms}ms`);
      report.push({ mode, view, dest, ms, method: "ffmpeg-jpeg-frames", nFrames: info.nFrames });
    }
  }
  await browser.close();
  await writeFile(path.join(OUT, "demo-report.json"), JSON.stringify(report, null, 2));
  console.log("\nall demos done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
