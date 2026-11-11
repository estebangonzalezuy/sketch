// Demo "serie": 9 harmonógrafos dibujándose a la vez (6 presets + 3 random con semilla), mismo par, grilla 3×3.
// Cada celda se renderiza con el Renderer de la tool y se arma con ffmpeg xstack. MP4 1080×1350 yuv420p.
import { chromium } from "playwright-core";
import { spawnSync } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
const PAL = +(process.env.PALETTE ?? 0);
const b = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.goto("http://127.0.0.1:5191/", { waitUntil: "networkidle" });
await p.waitForFunction(() => window.__harmono && window.__harmono.ready());
const list = await p.evaluate(() => [...window.__harmono.presets, window.__harmono.random(11, 3), window.__harmono.random(23, 2), window.__harmono.random(42, 4)]);
await b.close();
await mkdir("out/serie", { recursive: true });
const cells = [];
for (let i = 0; i < list.length; i++) {
  const pr = { ...list[i], palette: PAL, invert: false, caption: false, penWidth: 2.2, margin: 0.1 };
  const f = `out/serie/c${i}.json`; await writeFile(f, JSON.stringify(pr, null, 2));
  const out = `out/serie/c${i}.mp4`;
  const r = spawnSync("node", ["scripts/render.mjs", f, out], { stdio: "inherit" }); if (r.status) process.exit(1);
  cells.push(out);
}
// 3×3 de 360×450 = 1080×1350
const fc = cells.map((_, i) => `[${i}:v]scale=360:450[s${i}]`).join(";") + ";" + cells.map((_, i) => `[s${i}]`).join("") +
  "xstack=inputs=9:layout=0_0|360_0|720_0|0_450|360_450|720_450|0_900|360_900|720_900[o]";
spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...cells.flatMap(c => ["-i", c]), "-filter_complex", fc, "-map", "[o]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-r", "30", "-movflags", "+faststart", "out/demo-serie-3x3.mp4"], { stdio: "inherit" });
console.log("out/demo-serie-3x3.mp4");
