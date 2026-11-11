// Prueba de exportación MP4 en chico. Uso: node scripts/export-test.cjs <salida.mp4> [ffmpeg]
const { chromium } = require('playwright')
;(async () => {
  const [out, force] = process.argv.slice(2)
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } })
  p.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 500)) })
  p.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 500)))
  await p.goto((process.env.URL || 'http://localhost:5173/') + '?px=4000')
  await p.waitForFunction('!!window.__vitro && !!window.__vitro.rt.engine', null, { polling: 300 })
  const r = await p.evaluate(async (force) => {
    const v = window.__vitro
    v.actions.edit((s) => ({ ...s, anim: { ...s.anim, duration: 1, fps: 12 }, render: { ...s.render, bounces: 4 } }))
    const labels = new Set()
    const un = v.useStore.subscribe((s) => s.busy && labels.add(s.busy.label.replace(/cuadro \d+ de/, 'cuadro N de').replace(/faltan.*/, '')))
    const blob = await v.renderMp4(0.1, 2, force || undefined)
    un()
    if (!blob) return { error: 'sin blob' }
    const buf = new Uint8Array(await blob.arrayBuffer())
    let s = ''; for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i])
    return { size: buf.length, labels: [...labels], b64: btoa(s) }
  }, force)
  if (r.b64) { require('fs').writeFileSync(out, Buffer.from(r.b64, 'base64')); delete r.b64 }
  console.log(JSON.stringify(r)); process.exit(0)
})().catch((e) => { console.error(String(e).slice(0, 800)); process.exit(1) })
