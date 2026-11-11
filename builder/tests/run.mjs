#!/usr/bin/env node
// Tests del core (fase 2). npm test
//  1. paleta en el código: ni #0000FF ni #3D3DEB
//  2. paleta en píxeles: cada píxel del frame está sobre la recta bg–fg del par (AA permitido)
//  3. determinismo: frame 90 dos veces = mismos píxeles
//  4. presets: guardar → cambiar → cargar → frame 90 igual
//  5. loop del atractor: frame 0 ≈ frame T
//  6. MP4 camino 1 (WebCodecs + mp4-muxer) → ffprobe h264 / yuv420p / 30 fps / duración
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launch, openBuilder, ROOT, serve } from "../scripts/lib.mjs";

const PAIRS = [
  ["#0C0C0C", "#FFFFFF"],
  ["#0C0C0C", "#E4FC24"],
  ["#3C240C", "#CC84FC"],
  ["#0C540C", "#F06CCC"],
];
// entornos implementados = los que tienen load() en el registro
const ENVS = [...readFileSync(resolve(ROOT, "src/envs/index.ts"), "utf8").matchAll(/id: "([^"]+)"[^\n]*load: \(\) => import/g)].map((m) => m[1]).filter((e) => !process.env.ONLY || process.env.ONLY.split(",").includes(e));
let fails = 0;
const ok = (name, cond, info = "") => {
  console.log(`${cond ? "ok  " : "FALLA"} ${name}${info ? ` · ${info}` : ""}`);
  if (!cond) fails++;
};

// 1 ─ código fuente
function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const banned = /#(0000ff|3d3deb)\b/i;
const hits = [...walk(resolve(ROOT, "src")), resolve(ROOT, "index.html")].filter((f) => banned.test(readFileSync(f, "utf8")));
ok("paleta en el código", hits.length === 0, hits.join(", "));

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** máxima distancia de un píxel a la recta bg–fg (y fuera del segmento) */
function offLine(buf, bg, fg) {
  const [b, f] = [rgb(bg), rgb(fg)];
  const d = f.map((v, i) => v - b[i]);
  const dd = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
  let worst = 0;
  const seen = new Map();
  for (let i = 0; i < buf.length; i += 4) {
    const key = (buf[i] << 16) | (buf[i + 1] << 8) | buf[i + 2];
    if (seen.has(key)) continue;
    const px = [buf[i] - b[0], buf[i + 1] - b[1], buf[i + 2] - b[2]];
    let t = (px[0] * d[0] + px[1] * d[1] + px[2] * d[2]) / dd;
    const tc = Math.min(1, Math.max(0, t));
    const dist = Math.hypot(px[0] - tc * d[0], px[1] - tc * d[1], px[2] - tc * d[2]);
    seen.set(key, dist);
    if (dist > worst) worst = dist;
  }
  return { worst, colors: seen.size };
}

const pixels = async (page, i) => {
  const r = await page.evaluate((n) => window.__builder.pixels(n), i);
  return Buffer.from(r.data, "base64");
};
const diffFrac = (a, b) => {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
  return n / (a.length / 4);
};

const server = await serve(process.env.BUILDER_URL);
const browser = await launch();
try {
  for (const env of ENVS) {
    const { page } = await openBuilder(browser, server.url, { env, seed: "1842", pair: "0", fmt: "4x5" });

    // 2 ─ píxeles en los 4 pares (+ invertido)
    for (let p = 0; p < 4; p++) {
      for (const inv of [false, true]) {
        await page.evaluate(([pair, invert]) => window.__builder.loadPreset({ pair, invert }), [p, inv]);
        const [bg, fg] = inv ? [PAIRS[p][1], PAIRS[p][0]] : PAIRS[p];
        const r = offLine(await pixels(page, 45), bg, fg);
        ok(`${env} píxeles par ${p}${inv ? " inv" : ""}`, r.worst <= 3, `${r.colors} colores, desvío máx ${r.worst.toFixed(1)}`);
      }
    }
    await page.evaluate(() => window.__builder.loadPreset({ pair: 0, invert: false }));

    // 3 ─ determinismo
    const a = await pixels(page, 90);
    await pixels(page, 30); // otro t en el medio (las simulaciones hacen reset y re-step)
    const b = await pixels(page, 90);
    ok(`${env} determinismo frame 90`, diffFrac(a, b) === 0, `${(diffFrac(a, b) * 100).toFixed(3)} % distinto`);

    // 4 ─ preset JSON ida y vuelta
    const saved = await page.evaluate(() => window.__builder.preset());
    await page.evaluate(() => window.__builder.loadPreset({ ...window.__builder.preset(), seed: 77, params: {} }));
    await page.evaluate(async () => {
      const s = window.__builder.state();
      return s;
    });
    const changed = await pixels(page, 90);
    await page.evaluate((p) => window.__builder.loadPreset(p), saved);
    const c = await pixels(page, 90);
    ok(`${env} preset ida y vuelta`, diffFrac(a, c) === 0 && JSON.stringify(saved) === JSON.stringify(await page.evaluate(() => window.__builder.preset())), `cambio intermedio ${(diffFrac(a, changed) * 100).toFixed(1)} %`);

    // 5 ─ loop del atractor
    if ((await page.evaluate(() => window.__builder.timeline().loop)) === "seamless") {
      const T = await page.evaluate(() => window.__builder.duration());
      const f0 = await pixels(page, 0);
      const fT = await pixels(page, Math.round(T * 30));
      const d = diffFrac(f0, fT);
      ok(`${env} loop cierra (frame 0 ≈ frame T)`, d < 0.02, `${(d * 100).toFixed(2)} % de píxeles distintos`);
    }

    // 6 ─ MP4 camino 1
    const codec = await page.evaluate(() => window.__builder.codec());
    if (!codec) {
      ok(`${env} mp4 webcodecs`, true, "este Chrome no tiene H.264 en WebCodecs: se omite (camino 2 obligatorio)");
    } else {
      const b64 = await page.evaluate(() => window.__builder.exportMp4(2));
      mkdirSync(resolve(ROOT, "out/test"), { recursive: true });
      const file = resolve(ROOT, `out/test/${env}-webcodecs.mp4`);
      writeFileSync(file, Buffer.from(b64, "base64"));
      const probe = JSON.parse(
        execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,pix_fmt,r_frame_rate,nb_frames:format=duration", "-of", "json", file]).toString(),
      );
      const st = probe.streams[0];
      const dur = Number(probe.format.duration);
      ok(
        `${env} mp4 webcodecs (${codec})`,
        st.codec_name === "h264" && st.pix_fmt === "yuv420p" && st.r_frame_rate === "30/1" && Math.abs(dur - 2) < 0.05,
        `${st.codec_name} ${st.pix_fmt} ${st.r_frame_rate} ${dur}s ${st.nb_frames} frames`,
      );
    }
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(fails ? `\n${fails} fallas` : "\ntodo ok");
process.exit(fails ? 1 : 0);
