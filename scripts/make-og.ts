/**
 * One-off: render the static Open Graph images (public/og/index.png, public/og/about.png).
 * Needs Playwright with Chromium available (`npx playwright install chromium` if missing).
 * Run with `npm run og`; the PNGs are committed, so builds don't need a browser.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const font = (w: number) =>
  readFileSync(resolve(root, `public/fonts/geist-sans-latin-${w}-normal.woff2`)).toString('base64');
const total = JSON.parse(readFileSync(resolve(root, 'src/data/studios.json'), 'utf8')).length;

const html = (title: string, kicker: string, line: string) => `<!doctype html><html><head><style>
@font-face{font-family:G;font-weight:400;src:url(data:font/woff2;base64,${font(400)})}
@font-face{font-family:G;font-weight:500;src:url(data:font/woff2;base64,${font(500)})}
@font-face{font-family:G;font-weight:800;src:url(data:font/woff2;base64,${font(800)})}
html,body{margin:0;width:1200px;height:630px;background:#f3f1ec;color:#151513;font-family:G}
.wrap{position:absolute;inset:64px 72px;display:flex;flex-direction:column;justify-content:space-between}
.k{font-size:20px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;display:flex;justify-content:space-between}
.k span:last-child{color:#625f58}
canvas{display:block}
.o{font-size:.55em;vertical-align:.62em;text-underline-offset:.12em}
.l{font-size:30px;display:flex;justify-content:space-between;align-items:end;border-top:2px solid #151513;padding-top:22px}
.l span:last-child{font-size:20px;letter-spacing:.12em;text-transform:uppercase;color:#625f58}
</style></head><body><div class="wrap">
<div class="k"><span>${kicker}</span><span>tMSC · Human + Tool</span></div>
<canvas id="c"></canvas>
<div class="l"><span>${line}</span><span>Sourced, not generated</span></div>
</div><script>
document.fonts.load('800 40px G').then(()=>{
  const text=${JSON.stringify(title)}, cell=8, size=150/cell, cols=Math.floor(1056/cell);
  const o=document.createElement('canvas'), x=o.getContext('2d');
  const f=()=>x.font='800 '+size+'px G'; f();
  const lines=[]; for(const w of text.split(' ')){const c=lines[lines.length-1]; if(c!==undefined&&x.measureText(c+' '+w).width<=cols) lines[lines.length-1]=c+' '+w; else lines.push(w);}
  const m=x.measureText('ÁHgjpq'), a=Math.ceil(m.actualBoundingBoxAscent), d=Math.ceil(m.actualBoundingBoxDescent), lh=Math.ceil(size*.98);
  o.width=cols; o.height=a+d+lh*(lines.length-1)+1; f(); x.fillStyle='#000';
  lines.forEach((l,i)=>x.fillText(l,0,a+i*lh));
  const px=x.getImageData(0,0,o.width,o.height).data, c=document.getElementById('c'), y=c.getContext('2d');
  c.width=o.width*cell; c.height=o.height*cell; y.fillStyle='#151513';
  for(let r=0;r<o.height;r++)for(let q=0;q<o.width;q++) if(px[(r*o.width+q)*4+3]>110) y.fillRect(q*cell,r*cell,cell,cell);
  document.body.dataset.ready='1';
});
</script></body></html>`;

// Geist's º sits on the baseline, so draw a raised, underlined ordinal instead
const NO = 'N<u class="o">o</u>';

const require = createRequire(import.meta.url);
// Playwright is not a project dependency (it ships with most CI/dev images); keep the typing minimal.
type Page = {
  setContent(html: string): Promise<void>;
  waitForSelector(sel: string): Promise<unknown>;
  screenshot(o: { path: string }): Promise<unknown>;
};
const { chromium } = require('playwright') as {
  chromium: { launch(): Promise<{ newPage(o: object): Promise<Page>; close(): Promise<void> }> };
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const shots: [string, string, string, string][] = [
  [
    'index',
    'Motion Studios Index',
    `${NO} 001 — ${NO} ${String(total).padStart(3, '0')}`,
    `${total} motion design studios, worldwide`,
  ],
  [
    'about',
    'About the Index',
    'Motion Studios Index',
    'Two public lists. Merged. Blanks left blank.',
  ],
];
for (const [name, title, kicker, line] of shots) {
  await page.setContent(html(title, kicker, line));
  await page.waitForSelector('body[data-ready]');
  await page.screenshot({ path: resolve(root, `public/og/${name}.png`) });
  console.log(`public/og/${name}.png`);
}
await browser.close();
