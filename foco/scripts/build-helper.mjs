// Compila el helper privilegiado y lo deja donde Tauri lo busca para meterlo
// en el .app (bundle.externalBin): src-tauri/binaries/foco-helper-<target>.
//   node scripts/build-helper.mjs [--release]
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const tauri = resolve(dirname(fileURLToPath(import.meta.url)), '../src-tauri');
const release = process.argv.includes('--release');
const host = execFileSync('rustc', ['-vV'], { encoding: 'utf8' }).match(/^host: (.+)$/m)[1];

execFileSync('cargo', ['build', '-p', 'foco-helper', ...(release ? ['--release'] : [])], { cwd: tauri, stdio: 'inherit' });

mkdirSync(resolve(tauri, 'binaries'), { recursive: true });
const from = resolve(tauri, 'target', release ? 'release' : 'debug', 'foco-helper');
const to = resolve(tauri, 'binaries', `foco-helper-${host}`);
copyFileSync(from, to);
console.log(`helper → ${to}`);
