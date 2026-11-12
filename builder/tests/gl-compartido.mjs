#!/usr/bin/env node
// three.js (Plantas 3D) y GL crudo (Feedback) comparten el contexto WebGL2 del builder:
// alternar entre ellos y cambiar de formato tiene que dar el mismo cuadro que en limpio.
import { createHash } from "node:crypto";
import { launch, openBuilder, serve } from "../scripts/lib.mjs";
const server = await serve(); const b = await launch();
const h = async (page, i) => createHash("sha1").update((await page.evaluate((n) => window.__builder.pixels(n), i)).data).digest("hex").slice(0, 10);
const fresh = {};
for (const env of ["plantas-3d", "feedback"]) { const { page } = await openBuilder(b, server.url, { env, seed: "1842", pair: "0" }); fresh[env] = await h(page, 120); await page.close(); }
const { page } = await openBuilder(b, server.url, { env: "plantas-3d", seed: "1842", pair: "0" });
const seq = ["plantas-3d", "feedback", "plantas-3d", "feedback", "plantas-3d"];
let ok = true;
for (const env of seq) { await page.evaluate((e) => window.__builder.loadPreset({ env: e, seed: 1842, pair: 0 }), env); const v = await h(page, 120); const same = v === fresh[env]; ok &&= same; console.log(env, v, same ? "= limpio" : "DISTINTO de " + fresh[env]); }
// cambio de formato con three
await page.evaluate(() => window.__builder.loadPreset({ env: "plantas-3d", fmt: "16x9" })); const a = await h(page, 120);
await page.evaluate(() => window.__builder.loadPreset({ env: "plantas-3d", fmt: "4x5" })); const c = await h(page, 120);
console.log("formato 16:9 → 4:5 vuelve al mismo cuadro:", c === fresh["plantas-3d"], "(16:9 distinto:", a !== c, ")");
const pass = ok && c === fresh["plantas-3d"];
console.log(pass ? "\ntodo ok" : "\nFALLA");
await b.close(); await server.close();
process.exit(pass ? 0 : 1);
