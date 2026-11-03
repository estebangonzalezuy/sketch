import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFacets, buildStudios, readCsv, type CsvRow, type ExtendedRow } from './lib.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = resolve(root, 'data/studios.csv');
const extPath = resolve(root, 'data/studios_extended.csv');
const outDir = resolve(root, 'src/data');

const rows = readCsv<CsvRow>(readFileSync(csvPath, 'utf8'));
// Only `instagram` is used from the extended file. `description` is deliberately ignored.
const extended = existsSync(extPath) ? readCsv<ExtendedRow>(readFileSync(extPath, 'utf8')) : [];

const studios = buildStudios(rows, extended);
const facets = buildFacets(studios);

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'studios.json'), JSON.stringify(studios));
writeFileSync(resolve(outDir, 'facets.json'), JSON.stringify(facets));

const unknownCities = Object.values(facets.cityCountry).filter((c) => c === null).length;
console.log(
  `build-data: ${studios.length} studios, ${facets.countries.length} countries, ` +
    `${facets.cities.length} cities (${unknownCities} without a resolvable country), ` +
    `${extended.length ? `${studios.filter((s) => s.instagram).length} instagram links` : 'no extended csv'}`,
);
