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
const b64 = (f: string) => readFileSync(resolve(root, `public/fonts/${f}`)).toString('base64');
const total = JSON.parse(readFileSync(resolve(root, 'src/data/studios.json'), 'utf8')).length;

const html = (title: string, kicker: string, line: string) => `<!doctype html><html><head><style>
@font-face{font-family:S;font-style:normal;src:url(data:font/woff2;base64,${b64('instrument-serif-latin-400-normal.woff2')})}
@font-face{font-family:S;font-style:italic;src:url(data:font/woff2;base64,${b64('instrument-serif-latin-400-italic.woff2')})}
@font-face{font-family:G;font-weight:400;src:url(data:font/woff2;base64,${b64('geist-sans-latin-400-normal.woff2')})}
html,body{margin:0;width:1200px;height:630px;background:#f4f1ea;color:#1b1915}
.wrap{position:absolute;inset:64px 72px 60px;display:flex;flex-direction:column;justify-content:space-between}
.k{font:400 16px G;letter-spacing:.16em;text-transform:uppercase;color:#6b665c;display:flex;justify-content:space-between}
h1{font:400 156px/0.86 S;letter-spacing:-.025em;margin:0}
h1 em{font-style:italic;letter-spacing:-.01em}
.l{display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid rgb(27 25 21/.26);padding-top:20px}
.l span:first-child{font:italic 400 30px S}
.l span:last-child{font:400 16px G;letter-spacing:.16em;text-transform:uppercase;color:#6b665c}
</style></head><body><div class="wrap">
<div class="k"><span>${kicker}</span><span>Sourced, not generated</span></div>
<h1>${title}</h1>
<div class="l"><span>${line}</span><span>${total} studios</span></div>
</div></body></html>`;

type Page = {
  setContent(html: string): Promise<void>;
  evaluate(fn: string): Promise<unknown>;
  screenshot(o: { path: string }): Promise<unknown>;
};
// Playwright is not a project dependency (it ships with most CI/dev images); keep the typing minimal.
const require = createRequire(import.meta.url);
const { chromium } = require('playwright') as {
  chromium: { launch(): Promise<{ newPage(o: object): Promise<Page>; close(): Promise<void> }> };
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const shots: [string, string, string, string][] = [
  ['index', 'Motion Studios<br><em>Index</em>', 'A catalogue', 'Motion design studios, worldwide'],
  [
    'about',
    'About the<br><em>Index</em>',
    'Motion Studios Index',
    'Two public lists. Blanks left blank.',
  ],
];
for (const [name, title, kicker, line] of shots) {
  await page.setContent(html(title, kicker, line));
  await page.evaluate('document.fonts.ready');
  await page.screenshot({ path: resolve(root, `public/og/${name}.png`) });
  console.log(`public/og/${name}.png`);
}
await browser.close();
