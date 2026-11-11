// Genera miniaturas de presets y los loops de ejemplo con el propio editor, en Chromium sin GPU.
// Uso: node scripts/examples.cjs thumbs | loops [nombre]
const { chromium } = require('playwright')
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process')
const root = path.join(__dirname, '..')
const LOOPS = [
  { preset: 'Metal líquido', file: 'metal-liquido', scale: 0.3, spp: 10, patch: { duration: 2.5, fps: 24, bounces: 5 } },
  { preset: 'Toro de vidrio', file: 'toro-de-vidrio', scale: 0.3, spp: 10, patch: { duration: 2.5, fps: 24, bounces: 8 } },
  { preset: 'Discos', file: 'discos', scale: 0.3, spp: 8, patch: { duration: 2, fps: 24, bounces: 12 } },
]
;(async () => {
  const [mode, only] = process.argv.slice(2)
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } })
  p.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 400)))
  await p.goto((process.env.URL || 'http://localhost:5173/') + '?px=3000')
  await p.waitForFunction('!!window.__vitro && !!window.__vitro.rt.engine', null, { polling: 300 })
  const run = (job) => p.evaluate(async (job) => {
    const v = window.__vitro
    const pr = v.PRESETS.find((x) => x.name === job.preset)
    const sc = pr.build()
    if (job.patch) { sc.anim.duration = job.patch.duration; sc.anim.fps = job.patch.fps; sc.render.bounces = job.patch.bounces }
    if (job.bounces) sc.render.bounces = Math.min(sc.render.bounces, job.bounces)
    v.loadScene(sc, false)
    const blob = job.png ? await v.renderPng(job.scale, job.spp) : await v.renderMp4(job.scale, job.spp)
    if (!blob) return null
    const buf = new Uint8Array(await blob.arrayBuffer())
    let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192))
    return btoa(s)
  }, job)
  const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (mode === 'thumbs') {
    const names = await p.evaluate('window.__vitro.PRESETS.map((x) => x.name)')
    for (const name of names) {
      if (only && name !== only) continue
      const t = Date.now()
      const b64 = await run({ preset: name, png: true, scale: 0.2, spp: 14, bounces: 10 })
      if (!b64) { console.log('falló', name); continue }
      const png = path.join(root, 'public/thumbs', slug(name) + '.png')
      fs.writeFileSync(png, Buffer.from(b64, 'base64'))
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '3', png.replace('.png', '.jpg')]); fs.unlinkSync(png)
      console.log('thumb', name, ((Date.now() - t) / 1000).toFixed(0) + 's')
    }
  } else {
    for (const job of LOOPS) {
      if (only && job.file !== only) continue
      const t = Date.now()
      const b64 = await run(job)
      if (!b64) { console.log('falló', job.preset); continue }
      fs.writeFileSync(path.join(root, 'examples', job.file + '.mp4'), Buffer.from(b64, 'base64'))
      console.log('loop', job.file, ((Date.now() - t) / 60000).toFixed(1) + ' min')
    }
  }
  process.exit(0)
})().catch((e) => { console.error(String(e).slice(0, 800)); process.exit(1) })
