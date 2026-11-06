import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('render determinista', () => {
  it.each(['src/core', 'src/engine', 'src/tools'])('%s no usa azar ni relojes', (dir) => {
    for (const file of files(dir)) {
      const found = stripComments(readFileSync(file, 'utf8')).match(/Math\.random|Date\.now|performance\.now|requestAnimationFrame|new Date\b|THREE\.Clock/);
      expect(found?.[0], file).toBeUndefined();
    }
  });
});
