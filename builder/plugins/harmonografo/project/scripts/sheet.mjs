// Hoja de stills (6 presets, cuadro final) + SVG de plotter de cada uno, con el mismo Renderer de la tool.
import { chromium } from "playwright-core";
import { writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const b = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.goto("http://127.0.0.1:5191/", { waitUntil: "networkidle" });
await p.waitForFunction(() => window.__harmono && window.__harmono.ready());
await mkdir("out/stills", { recursive: true }); await mkdir("out/svg", { recursive: true });
const ps = await p.evaluate(() => window.__harmono.presets);
const files = [];
for (let i = 0; i < ps.length; i++) {
  const pr = ps[i]; const slug = `${String(i + 1).padStart(2, "0")}-${pr.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-")}`;
  const png = await p.evaluate(([pr]) => window.__harmono.still(pr, pr.drawSeconds + 0.01), [pr]);
  await writeFile(`out/stills/${slug}.png`, Buffer.from(png.split(",")[1], "base64")); files.push(`out/stills/${slug}.png`);
  const { svg, points } = await p.evaluate(([pr]) => window.__harmono.svg(pr), [pr]);
  await writeFile(`out/svg/${slug}.svg`, svg); console.log(slug, "svg puntos", points, (svg.length / 1024).toFixed(0) + " KB");
  await writeFile(`presets/${slug}.json`, JSON.stringify(pr, null, 2));
}
await b.close();
// grilla 3×2 con ffmpeg (sin dependencias extra)
execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...files.flatMap(f => ["-i", f]), "-filter_complex",
  files.map((_, i) => `[${i}:v]scale=540:675[s${i}]`).join(";") + ";" + files.map((_, i) => `[s${i}]`).join("") + `xstack=inputs=${files.length}:layout=0_0|540_0|1080_0|0_675|540_675|1080_675[o]`,
  "-map", "[o]", "-frames:v", "1", "out/hoja-stills.png"]);
console.log("out/hoja-stills.png");
