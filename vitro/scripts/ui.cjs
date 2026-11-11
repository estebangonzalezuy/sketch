// Uso: node scripts/ui.cjs <salida.png> [js a evaluar antes de capturar] [espera ms]
const { chromium } = require('playwright')
;(async () => {
  const [out, js = '', wait = '6000', scheme = 'dark'] = process.argv.slice(2)
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme })
  p.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 800)) })
  p.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 800)))
  await p.goto(process.env.URL || 'http://localhost:5173/')
  await p.waitForTimeout(Number(wait))
  if (js) { console.log('eval:', JSON.stringify(await p.evaluate(js))); await p.waitForTimeout(2500) }
  await p.screenshot({ path: out, timeout: 120000, animations: 'disabled' })
  console.log('shot ok'); process.exit(0)
})().catch((e) => { console.error(String(e).slice(0, 600)); process.exit(1) })
